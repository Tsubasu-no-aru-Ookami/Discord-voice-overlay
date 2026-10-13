# Inui_Toko_DS

A personalised Discord voice channel overlay (Electron + Discord RPC).
Shows who is in the voice channel, who is speaking and who has been muted.

## Getting started

1. `npm install`
2. Copy `.env.example` to `.env` and enter `DISCORD_CLIENT_SECRET`
3. Launch Discord (desktop app)
4. `npm start`

The first time you run it, Discord will ask you to grant the app access; click ‘Authorise’.
Your login details will then be saved and you won’t be asked again.

## Running without the console (exe)

1. `npm install` (once; the build tool will be installed)
2. `npm run build`
3. The finished programme will appear in `dist/DiscordVoiceOverlay-win32-x64/` (the `DiscordVoiceOverlay.exe` file).
   You can move this entire folder anywhere, for example to `C:\Apps`.
4. Place the `.env` file containing `DISCORD_CLIENT_SECRET` next to `DiscordVoiceOverlay.exe`.
5. Run it by double-clicking. There is no console window; control is via the icon in the system tray.

The secret is not included in the build. After modifying the code, you’ll need to rebuild using the command `npm run build`.
Errors are logged to the `overlay.log` file (system tray -> ‘Data and log folder’).
Autostart with Windows after moving or rebuilding: uncheck and then re-check the box in the settings.

## Customising the appearance

The overlay icon appears in the system tray (next to the clock). Clicking it opens the settings window:
transparency for silent and speaking modes, sizes, colours, animation, window position and size.
All changes are applied immediately and saved automatically.

- **Move mode**: displays the window frame; the overlay can be moved with the mouse. The position is remembered
  (including the monitor). If avatars are cropped at the edge of the frame, increase the width or height of the window.
- **Test participants**: to customise the appearance without being in the voice channel.
- **Start with Windows**: tick the box in the ‘System’ section. This works as long as the project folder remains in place.

The settings file is located in the application data folder (`%APPDATA%`, a subfolder named after the application), named `settings.json`.
The default values and valid ranges are listed at the start of `main.js`.
Fine-tune the view manually: `index.html` (the `<style>` block).

The secret and tokens are not included in the repository (`.env` is in `.gitignore`).

Translated with DeepL.com (free version)

# Inui_Toko_DS

Личный оверлей голосового канала Discord (Electron + Discord RPC).
Показывает, кто сидит в голосовом канале, кто говорит и кто замьючен.

## Запуск

1. `npm install`
2. Скопировать `.env.example` в `.env` и вписать `DISCORD_CLIENT_SECRET`
3. Запустить Discord (десктопное приложение)
4. `npm start`

При первом запуске Discord попросит разрешить доступ приложению, нужно нажать «Авторизовать».
Дальше вход сохраняется и повторно спрашивать не будет.

## Запуск без консоли (exe)

1. `npm install` (один раз, подтянется сборщик)
2. `npm run build`
3. Готовая программа появится в `dist/DiscordVoiceOverlay-win32-x64/` (файл `DiscordVoiceOverlay.exe`).
   Всю эту папку можно перенести куда угодно, например в `C:\Apps`.
4. Положите файл `.env` с `DISCORD_CLIENT_SECRET` рядом с `DiscordVoiceOverlay.exe`.
5. Запускайте двойным кликом. Окна консоли нет, управление через значок в трее.

Секрет в сборку не попадает. После изменения кода сборку нужно повторить командой `npm run build`.
Ошибки пишутся в файл `overlay.log` (трей -> «Папка с данными и логом»).
Автозапуск с Windows после переноса или пересборки: снимите и снова поставьте галочку в настройках.

## Настройка внешнего вида

Значок оверлея появляется в трее (рядом с часами). Клик по нему открывает окно настроек:
прозрачность молчащих и говорящих, размеры, цвета, анимация, положение и размер окна.
Всё применяется сразу и сохраняется само.

- **Режим перемещения**: показывает рамку окна, оверлей можно двигать мышью. Положение запоминается
  (в том числе монитор). Если аватарки обрезаются по краю рамки, увеличьте ширину или высоту окна.
- **Тестовые участники**: чтобы подбирать вид, не сидя в голосовом канале.
- **Запускать вместе с Windows**: галочка в разделе «Система». Работает, пока папка проекта на месте.

Файл настроек лежит в папке данных приложения (`%APPDATA%`, подпапка с именем приложения), файл `settings.json`.
Значения по умолчанию и допустимые границы лежат в начале `main.js`.
Тонкая правка вида руками: `index.html` (блок `<style>`).

Секрет и токены в репозиторий не попадают (`.env` в `.gitignore`).
