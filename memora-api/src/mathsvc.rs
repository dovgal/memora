//! Клиент CAS-микросервиса memora-math (SymPy).
//!
//! Конфигурация: `MATH_SERVICE_URL` (базовый URL) + `MATH_SERVICE_TOKEN`.
//! Без них сервис считается не настроенным: проверка symbolic отвечает 503,
//! варианты numeric-задач не генерируются (LLM без CAS-верификации не доверяем).

use std::env;
use std::time::Duration;

fn env_nonempty(key: &str) -> Option<String> {
    env::var(key).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn configured() -> bool {
    env_nonempty("MATH_SERVICE_URL").is_some()
}

async fn post(path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let base = env_nonempty("MATH_SERVICE_URL").ok_or("MATH_SERVICE_URL is not set")?;
    let url = format!("{}/{}", base.trim_end_matches('/'), path);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.post(&url).json(&body);
    if let Some(token) = env_nonempty("MATH_SERVICE_TOKEN") {
        req = req.header("Authorization", format!("Bearer {}", token));
    }

    let resp = req.send().await.map_err(|e| format!("math service unreachable: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("math service {}: {}", status, text.chars().take(200).collect::<String>()));
    }
    resp.json().await.map_err(|e| format!("math service bad response: {}", e))
}

/// Численное значение выражения («3,5*2» → 7.0).
pub async fn evaluate(expression: &str) -> Result<f64, String> {
    let v = post("evaluate", serde_json::json!({ "expression": expression })).await?;
    v.get("value").and_then(|x| x.as_f64()).ok_or_else(|| "no value in response".to_string())
}

/// Эквивалентны ли два выражения (CAS: simplify(a-b) == 0).
pub async fn check_equivalence(expected: &str, given: &str) -> Result<bool, String> {
    let v = post("check-equivalence", serde_json::json!({ "expected": expected, "given": given })).await?;
    v.get("equivalent").and_then(|x| x.as_bool()).ok_or_else(|| "no equivalent in response".to_string())
}
