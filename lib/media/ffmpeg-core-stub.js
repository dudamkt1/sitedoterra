/**
 * Stub usado só pelo webpack em DESEVELOPIMENTO.
 *
 * `@ffmpeg/ffmpeg` monta, quando NODE_ENV=development, o corePath com
 * `new URL('/node_modules/@ffmpeg/core/dist/ffmpeg-core.js', import.meta.url)`.
 * O webpack tenta resolver esse caminho, `@ffmpeg/core` não está instalado e a
 * build de DEV falha — derrubando QUALQUER página que importa MediaUploader
 * (ex.: /admin/catalogo, que ficava em branco, sem os botões Editar/Excluir).
 *
 * O código real NUNCA usa esse default: `lib/media/compress-client.ts` sempre
 * informa um corePath explícito (CDN), então este arquivo só existe para o
 * resolver do webpack ter o que encontrar.
 */
module.exports = {};
