// Сборка в exe:  npm run build
// Результат: папка dist/DiscordVoiceOverlay-win32-x64 с файлом DiscordVoiceOverlay.exe
const path = require("path");
const { packager } = require("@electron/packager");

packager({
  dir: __dirname,
  name: "DiscordVoiceOverlay",
  platform: "win32",
  arch: "x64",
  icon: path.join(__dirname, "icon.ico"),
  out: path.join(__dirname, "dist"),
  overwrite: true,
  asar: true,
  // что в сборку не кладём: секрет, готовые сборки, git, личные заметки
  ignore: [
    /^\/dist($|\/)/,
    /^\/\.git($|\/)/,
    /^\/\.env$/,
    /^\/.*\.txt$/,
    /^\/.*\.zip$/,
    /^\/README\.md$/,
  ],
})
  .then((paths) => {
    console.log("\nГотово:\n" + paths.join("\n"));
    console.log("\nПоложите файл .env (с DISCORD_CLIENT_SECRET) рядом с DiscordVoiceOverlay.exe.");
  })
  .catch((err) => {
    console.error("Сборка не удалась:", err.message || err);
    process.exit(1);
  });
