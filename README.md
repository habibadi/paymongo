# AI-Driven SDET Quality Gate (Playwright + Gemini + Browser-Use)

Proyek ini adalah prototipe sistem **Continuous Integration (CI) cerdas** yang berfungsi sebagai *Quality Gate* untuk Backend (API) dan Frontend (UI). Sistem menggunakan kecerdasan buatan (Google Gemini) dan agen navigasi otonom (`browser-use`) untuk merancang skenario pengujian E2E *(End-to-End)* secara otomatis berdasarkan keadaan aplikasi saat ini, mengeksekusi tes, dan memverifikasi interaksinya.

## 🔥 Fitur Utama

- **Autonomous UI Explorer** (`browser-use`): Generator Python akan mengendarai browser layaknya pengguna sungguhan, menjelajahi aplikasi Next.js Anda (tanpa perlu mendefinisikan *selector* manual), dan merekam setiap *state* halaman.
- **LLM Test Code Generator** (`gemini-3-flash-preview`): Log interaksi agen diterjemahkan secara otomatis menjadi script `*.spec.ts` murni menggunakan framework Playwright. 
- **Auto-Healing Locators**: Script yang di-*generate* menggunakan pola `page.getByRole().or(page.locator("X_PATH"))`. Locator utama akan memakai *Web-First Assertions* yang divalidasi Gemini, sementara locator *fallback* mengambil koordinat DOM presisi dari memori Agen (*JSON Extract*). Ini membuat UI test Anda kebal terhadap "flaky failures" akibat refactor CSS/Class.
- **Zero-Config Workflow**: Tes dihasilkan secara on-the-fly (`generated_test/`) dan tidak mengotori repositori kode inti (*blueprint*).

## 🚀 Arsitektur CI/CD (Docker Compose & GitHub Actions)

Proyek ini **sepenuhnya kompatibel dengan GitHub Actions dan cloud runner**, karena:
1. Menggunakan Docker Image resmi `mcr.microsoft.com/playwright` versi terbaru yang berisi *OS dependencies* (.deb list) untuk Browser Headless.
2. Generator Python disetel dengan *environment variable* `HEADLESS=true` dan `ANONYMIZED_TELEMETRY=false` sehingga Browser-Use bisa beroperasi tanpa memerlukan tampilan antarmuka (X11 server / monitor).
3. GitHub API Artifacts: Artefak pelaporan uji Playwright HTML *(Playwright Report)* dan file log otomatis diunggah ke *Artifacts CI* setiap PR dieksekusi, mempermudah tim QA/Developer meninjau penyebab kegagalan (`--exit-code-from tester`).

## 🛠 Instalasi dan Menjalankan Lokal (Local Testing)

Pastikan Windows/Mac/Linux Anda telah terinstall Docker Desktop.

1. Atur berkas lingkungan: Buka `application_code/.env` lalu masukkan API Key Anda:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
2. Nyalakan sistem orchestrator (API, UI, Test Generator, dan Test Runner):
   ```bash
   cd application_code
   docker compose up --build --abort-on-container-exit
   ```
3. Cek folder `application_code/generated_test/`: Script tes otomatis `.spec.ts` dan rekaman interaksinya (`.md` & `.json`) akan terbit di sini.
4. Cek folder `application_code/generated_test/playwright-report/` untuk melihat laporan HTML dari eksekusi tes Playwright.

## ♾ Integrasi GitHub Actions (Telah Diatur!)

Pipeline CI/CD telah tersedia di dalam file `.github/workflows/quality-gate.yml`. Cukup atur **Repository Secrets** di GitHub dengan nama `GEMINI_API_KEY`, dan *Quality Gate* akan langsung menyala pada setiap pembuatan **Pull Request** ke *branch* utama.
