use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::hooks::HookEvent;
use crate::state::{PulseStatus, SharedState};

#[derive(Clone)]
struct AppState {
    pulse_state: SharedState,
    app_handle: AppHandle,
}

async fn handle_hook_event(
    State(state): State<AppState>,
    Json(event): Json<HookEvent>,
) -> StatusCode {
    {
        let mut sm = state.pulse_state.lock().unwrap();
        sm.process_event(&event);
        let status = sm.status();
        write_state_file(&status);
        let _ = state.app_handle.emit("pulse-state", &status);
    }
    StatusCode::OK
}

async fn handle_status(State(state): State<AppState>) -> Json<PulseStatus> {
    let sm = state.pulse_state.lock().unwrap();
    Json(sm.status())
}

async fn handle_health() -> &'static str {
    "ok"
}

async fn handle_visibility(State(state): State<AppState>) -> StatusCode {
    if let Some(window) = state.app_handle.get_webview_window("pulse") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
        }
    }
    StatusCode::OK
}

async fn handle_quit(State(state): State<AppState>) -> StatusCode {
    cleanup_state_file();
    state.app_handle.exit(0);
    StatusCode::OK
}

fn state_file_path() -> std::path::PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".claude")
        .join("pulse-state.json")
}

fn write_state_file(status: &PulseStatus) {
    if let Ok(json) = serde_json::to_string_pretty(status) {
        let _ = std::fs::write(state_file_path(), json);
    }
}

fn cleanup_state_file() {
    let _ = std::fs::remove_file(state_file_path());
}

pub const PORT: u16 = 3200;

pub fn start_server(app_handle: AppHandle, pulse_state: SharedState, port: u16) {
    let state = AppState {
        pulse_state: pulse_state.clone(),
        app_handle: app_handle.clone(),
    };

    // Spawn the tick loop for state decay
    let tick_state = pulse_state.clone();
    let tick_handle = app_handle.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            let status = {
                let mut sm = tick_state.lock().unwrap();
                sm.tick();
                sm.status()
            };
            write_state_file(&status);
            let _ = tick_handle.emit("pulse-state", &status);
        }
    });

    // Start the HTTP server
    tokio::spawn(async move {
        let app = Router::new()
            .route("/hooks/event", post(handle_hook_event))
            .route("/status", get(handle_status))
            .route("/health", get(handle_health))
            .route("/control/visibility", post(handle_visibility))
            .route("/control/quit", post(handle_quit))
            .with_state(state);

        let addr = format!("127.0.0.1:{}", port);
        log::info!("Claude Pulse server listening on {}", addr);

        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .expect("Failed to bind HTTP server");

        axum::serve(listener, app)
            .await
            .expect("HTTP server error");
    });
}
