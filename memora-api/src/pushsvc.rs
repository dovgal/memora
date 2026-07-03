//! Web Push БЕЗ payload: VAPID-авторизация (ES256 JWT) + пустой POST на endpoint.
//!
//! Почему без payload: шифрование aes128gcm потребовало бы крейт `web-push` → `ece`
//! → openssl, а весь проект собран на rustls (и Railway-сборка хрупка к системным
//! зависимостям — см. историю с whisper-rs). Пустой push будит service worker,
//! текст напоминания живёт в нём (memora-web/src/app/sw.ts).
//!
//! Конфигурация:
//! - `VAPID_PUBLIC_KEY`  — публичный ключ (base64url, несжатая точка EC P-256, 65 байт);
//! - `VAPID_PRIVATE_PEM` — приватный ключ PEM (PKCS#8); `\n` в значении разворачивается;
//! - `VAPID_SUBJECT`     — контакт владельца (по умолчанию mailto:admin@memora.app).
//!
//! Генерация ключей:
//!   openssl ecparam -genkey -name prime256v1 | openssl pkcs8 -topk8 -nocrypt -out vapid.pem
//!   openssl ec -in vapid.pem -pubout -outform DER | tail -c 65 | basenc --base64url | tr -d '=\n'

use std::env;
use std::time::Duration;

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;

fn env_nonempty(key: &str) -> Option<String> {
    env::var(key).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn configured() -> bool {
    env_nonempty("VAPID_PUBLIC_KEY").is_some() && env_nonempty("VAPID_PRIVATE_PEM").is_some()
}

pub fn public_key() -> Option<String> {
    env_nonempty("VAPID_PUBLIC_KEY")
}

#[derive(Serialize)]
struct VapidClaims {
    /// Origin push-сервиса (scheme://host эндпоинта подписки).
    aud: String,
    exp: u64,
    sub: String,
}

fn vapid_jwt(endpoint: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(endpoint).map_err(|e| format!("bad endpoint: {e}"))?;
    let aud = format!("{}://{}", url.scheme(), url.host_str().unwrap_or_default());

    let pem = env_nonempty("VAPID_PRIVATE_PEM")
        .ok_or("VAPID_PRIVATE_PEM is not set")?
        .replace("\\n", "\n"); // Railway хранит многострочные значения с экранированными \n

    let key = EncodingKey::from_ec_pem(pem.as_bytes())
        .map_err(|e| format!("bad VAPID private key: {e}"))?;

    let claims = VapidClaims {
        aud,
        exp: (chrono::Utc::now() + chrono::Duration::hours(12)).timestamp() as u64,
        sub: env_nonempty("VAPID_SUBJECT").unwrap_or_else(|| "mailto:admin@memora.app".to_string()),
    };

    encode(&Header::new(Algorithm::ES256), &claims, &key).map_err(|e| format!("jwt: {e}"))
}

/// Исход отправки: доставлено, подписка умерла (удалить), прочая ошибка.
#[derive(Debug, PartialEq, Eq)]
pub enum PushOutcome {
    Sent,
    /// 404/410 — endpoint истёк, подписку надо удалить.
    Gone,
    Failed(String),
}

/// Пустой push (без payload): будит SW, который сам показывает напоминание.
pub async fn send_empty(endpoint: &str) -> PushOutcome {
    let jwt = match vapid_jwt(endpoint) {
        Ok(t) => t,
        Err(e) => return PushOutcome::Failed(e),
    };
    let public_key = match public_key() {
        Some(k) => k,
        None => return PushOutcome::Failed("VAPID_PUBLIC_KEY is not set".to_string()),
    };

    let client = match reqwest::Client::builder().timeout(Duration::from_secs(10)).build() {
        Ok(c) => c,
        Err(e) => return PushOutcome::Failed(e.to_string()),
    };

    let resp = client.post(endpoint)
        .header("Authorization", format!("vapid t={jwt}, k={public_key}"))
        .header("TTL", "86400")
        .header("Content-Length", "0")
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => PushOutcome::Sent,
        Ok(r) if r.status().as_u16() == 404 || r.status().as_u16() == 410 => PushOutcome::Gone,
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            PushOutcome::Failed(format!("{status}: {}", text.chars().take(200).collect::<String>()))
        }
        Err(e) => PushOutcome::Failed(e.to_string()),
    }
}
