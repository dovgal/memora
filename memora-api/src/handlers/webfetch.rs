// Забор страницы из интернета для читалки.
//
// Забирает сервер, а не браузер: чужие сайты браузеру читать не дают (правила
// разных источников), и без посредника ничего бы не вышло.
//
// Посредник, ходящий по любому присланному адресу, — известная дыра: у нас во
// внутренней сети живут база и распознавание речи, и запрос к ним изнутри
// прошёл бы без всякой авторизации. Поэтому адрес проверяется до обращения:
// только http и https, только публичные адреса, никаких внутренних имён.

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, ToSocketAddrs};

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

/// Потолок размера страницы. Статья столько не весит; всё, что больше, —
/// либо не статья, либо попытка забить память.
const MAX_BYTES: usize = 4 * 1024 * 1024;

#[derive(Deserialize)]
pub struct FetchRequest {
    pub url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResponse {
    /// Адрес после переходов — по нему клиент достраивает относительные ссылки.
    pub url: String,
    pub html: String,
}

/// Внутренний ли это адрес. Всё, что не маршрутизируется в интернете, для нас
/// под запретом: именно там стоят наши собственные службы.
fn is_private(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_unspecified()
                // 100.64.0.0/10 — сети провайдеров и внутренняя сеть Railway.
                || (v4.octets()[0] == 100 && (64..128).contains(&v4.octets()[1]))
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                // fc00::/7 — уникальные локальные, fe80::/10 — канальные.
                || (v6.segments()[0] & 0xfe00) == 0xfc00
                || (v6.segments()[0] & 0xffc0) == 0xfe80
        }
    }
}

fn check_url(raw: &str) -> ApiResult<url_lite::Parsed> {
    let parsed = url_lite::parse(raw)
        .ok_or_else(|| ApiError::response(StatusCode::BAD_REQUEST, "Не похоже на адрес страницы"))?;

    if parsed.scheme != "http" && parsed.scheme != "https" {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Поддерживаются только http и https"));
    }
    let host = parsed.host.to_lowercase();
    if host.is_empty()
        || host == "localhost"
        || host.ends_with(".internal")
        || host.ends_with(".local")
    {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Этот адрес недоступен"));
    }

    // Резолвим и проверяем каждый полученный адрес: имя может указывать куда
    // угодно, в том числе на нашу же внутреннюю сеть.
    let port = if parsed.scheme == "https" { 443 } else { 80 };
    let addrs = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Не удалось найти такой сайт"))?;
    let mut any = false;
    for addr in addrs {
        any = true;
        if is_private(&addr.ip()) {
            return Err(ApiError::response(StatusCode::FORBIDDEN, "Этот адрес недоступен"));
        }
    }
    if !any {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Не удалось найти такой сайт"));
    }
    Ok(parsed)
}

/// POST /api/web/fetch — забрать страницу и отдать её разметку клиенту.
/// Разбор текста — на клиенте: он это уже умеет, разбирая EPUB.
pub async fn fetch_page(
    AuthenticatedUser(_user): AuthenticatedUser,
    Json(payload): Json<FetchRequest>,
) -> ApiResult<impl IntoResponse> {
    let parsed = check_url(payload.url.trim())?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        // Переходы разрешаем, но немного: цепочка перенаправлений — обычный
        // способ увести запрос на внутренний адрес в обход проверки.
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("client: {e}")))?;

    let res = client
        .get(&parsed.full)
        .header("User-Agent", "Mozilla/5.0 (compatible; MemoraReader/1.0)")
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Страница не открылась: {e}")))?;

    let final_url = res.url().to_string();
    // Проверяем ещё раз: после переходов мы можем оказаться совсем не там.
    check_url(&final_url)?;

    let status = res.status();
    if !status.is_success() {
        return Err(ApiError::response(StatusCode::BAD_GATEWAY, format!("Сайт ответил {status}")));
    }
    let kind = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    if !kind.is_empty() && !kind.contains("html") && !kind.contains("xml") && !kind.contains("text/plain") {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "По этому адресу не страница с текстом"));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Не удалось прочитать страницу: {e}")))?;
    if bytes.len() > MAX_BYTES {
        return Err(ApiError::response(StatusCode::PAYLOAD_TOO_LARGE, "Страница слишком велика"));
    }

    Ok((StatusCode::OK, Json(FetchResponse {
        url: final_url,
        html: String::from_utf8_lossy(&bytes).to_string(),
    })))
}

/// Разбор адреса без внешних зависимостей: нужны только схема, хост и целое.
mod url_lite {
    pub struct Parsed {
        pub scheme: String,
        pub host: String,
        pub full: String,
    }

    pub fn parse(raw: &str) -> Option<Parsed> {
        let raw = raw.trim();
        let (scheme, rest) = raw.split_once("://")?;
        let scheme = scheme.to_lowercase();
        if rest.is_empty() {
            return None;
        }
        let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
        // Логин с паролем в адресе — приём для маскировки настоящего хоста.
        if authority.contains('@') {
            return None;
        }
        let host = authority.split(':').next().unwrap_or("").to_string();
        if host.is_empty() {
            return None;
        }
        Some(Parsed { scheme, host, full: raw.to_string() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn internal_addresses_are_refused() {
        assert!(is_private(&"127.0.0.1".parse().unwrap()));
        assert!(is_private(&"10.0.0.5".parse().unwrap()));
        assert!(is_private(&"192.168.1.1".parse().unwrap()));
        assert!(is_private(&"169.254.169.254".parse().unwrap()));
        // Внутренняя сеть Railway — именно там наши база и распознавание речи.
        assert!(is_private(&"100.64.0.2".parse().unwrap()));
        assert!(is_private(&"::1".parse().unwrap()));
        assert!(is_private(&"fd00::1".parse().unwrap()));
    }

    #[test]
    fn public_addresses_are_allowed() {
        assert!(!is_private(&"93.184.216.34".parse().unwrap()));
        assert!(!is_private(&"2606:2800:220:1:248:1893:25c8:1946".parse().unwrap()));
    }

    #[test]
    fn only_web_schemes_and_plain_hosts() {
        // У file-адреса нет хоста, и разбор отвергает его сразу — до проверки
        // схемы дело не доходит вовсе.
        assert!(url_lite::parse("file:///etc/passwd").is_none());
        assert!(url_lite::parse("https://user@evil.example/").is_none(), "адрес с логином — приём маскировки");
        assert!(url_lite::parse("not a url").is_none());
        let ok = url_lite::parse("https://example.com/a/b?c=1").unwrap();
        assert_eq!(ok.host, "example.com");
        assert_eq!(ok.scheme, "https");
    }
}
