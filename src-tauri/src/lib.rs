mod hooks;
mod server;
mod state;

use server::{start_server, PORT};
use state::new_shared_state;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pulse_state = new_shared_state(PORT);

    tauri::Builder::default()
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Remove window shadow (the dark circle outline)
            if let Some(window) = app.get_webview_window("pulse") {
                let _ = window.set_shadow(false);
            }

            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            let handle = app.handle().clone();
            let state = pulse_state.clone();

            std::thread::spawn(move || {
                rt.block_on(async {
                    start_server(handle, state, PORT);
                    loop {
                        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
                    }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
