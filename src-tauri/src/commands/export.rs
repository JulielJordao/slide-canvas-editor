use base64::{engine::general_purpose, Engine as _};
use tauri::Manager;

#[tauri::command]
pub async fn save_image(path: String, data: String) -> Result<(), String> {
    let bytes = general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_file_as_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
pub async fn save_project(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("{e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("{e}"))?;
    std::fs::write(dir.join("project.json"), data.as_bytes()).map_err(|e| format!("{e}"))
}

#[tauri::command]
pub async fn load_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("{e}"))?;
    let file = dir.join("project.json");
    if file.exists() {
        Ok(Some(std::fs::read_to_string(file).map_err(|e| format!("{e}"))?))
    } else {
        Ok(None)
    }
}
