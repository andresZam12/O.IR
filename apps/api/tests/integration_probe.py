import numpy as np
import soundfile as sf
import tempfile
import httpx
import time
import os

sr = 22050
duration = 3.0
t = np.linspace(0, duration, int(sr * duration), endpoint=False)
signal = 0.5 * np.sin(2 * np.pi * 440.0 * t) + 0.3 * np.sin(2 * np.pi * 554.37 * t)

with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
    temp_wav = f.name
sf.write(temp_wav, signal, sr)

try:
    print("1. Enviando archivo de audio al backend FastAPI...")
    with open(temp_wav, "rb") as audio_f:
        res = httpx.post(
            "http://127.0.0.1:8000/api/songs/upload",
            files={"file": ("test_sine_chord.wav", audio_f, "audio/wav")},
            timeout=10.0,
        )
    print("Upload status:", res.status_code)
    data = res.json()
    print("Respuesta:", data)
    job_id = data["job_id"]

    print("2. Iniciando polling del progreso...")
    for i in range(20):
        time.sleep(1)
        status_res = httpx.get(
            f"http://127.0.0.1:8000/api/songs/status/{job_id}",
            timeout=5.0,
        ).json()
        print(f"Poll {i+1}: status={status_res.get('status')}, progress={status_res.get('progress')}%, step={status_res.get('step')}")
        if status_res.get("status") in ["SUCCESS", "FAILURE"]:
            if status_res.get("status") == "SUCCESS":
                result = status_res["result"]
                print("\n===============================")
                print(">>> ¡PROCESAMIENTO EXITOSO! <<<")
                print("===============================")
                print("Tonalidad estimada:", result.get("estimated_key"))
                print("Acordes unicos:", result.get("unique_chords"))
                print("Total de cambios:", result.get("total_changes"))
                print("Score de dificultad:", result.get("difficulty", {}).get("overall_score"))
                print("Nivel:", result.get("difficulty", {}).get("difficulty_level"))
                print("Consejos:", result.get("difficulty", {}).get("pedagogical_tips"))
            else:
                print("Error en job:", status_res.get("error"))
            break
finally:
    if os.path.exists(temp_wav):
        os.remove(temp_wav)
