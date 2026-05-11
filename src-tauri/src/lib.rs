mod commands;

use commands::export::{save_image, read_file_as_base64, save_project, load_project};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![save_image, read_file_as_base64, save_project, load_project])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
