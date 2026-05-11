# Slide Canvas Editor

> Editor de apresentações estilo Canva, **desktop nativo**, com timeline de animações, fundos animados (imagem/vídeo/gradiente) e geração de imagens por IA.

[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Fabric.js](https://img.shields.io/badge/Fabric.js-6.x-FF6F61)](http://fabricjs.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Desenvolvimento](#desenvolvimento)
- [Build de produção](#build-de-produção)
- [Configuração de chaves de API](#configuração-de-chaves-de-api)
- [Atalhos de teclado](#atalhos-de-teclado)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Arquitetura e decisões](#arquitetura-e-decisões)
- [Testes](#testes)
- [Formato de arquivo `.sedp`](#formato-de-arquivo-sedp)
- [Solução de problemas](#solução-de-problemas)
- [Roadmap](#roadmap)
- [Licença](#licença)

---

## Funcionalidades

### Editor

- **Múltiplos slides** com reordenação por arrastar, duplicação e exclusão
- **Canvas Fabric.js** com texto editável, imagens, formas e seleção múltipla
- **Crop tool** integrado para imagens
- **Painel de camadas** (LayerPanel) com arrastar-para-reordenar, subir/descer/topo/fundo
- **Painel de propriedades flutuante** com edição de cor, fonte, espaçamento, contorno, sombra e opacidade
- **Cores dos handles adaptativas** — calculadas via luminância WCAG do fundo para garantir contraste
- **Undo / Redo** unificado que considera tanto o canvas quanto a timeline
- **Auto-save** do projeto enquanto você edita

### Fundos

- **Cor sólida**
- **Gradiente linear ou radial** com múltiplos stops
- **Imagem** com ajuste de cobertura
- **Vídeo** (`.mp4`, `.webm`, `.mov`) reproduzindo em loop como fundo

### Animação

- **Modo Animação** com painel de timeline expansível
- **Efeitos pré-definidos**: fade in/out, slide-in (4 direções), zoom in/out, rotate, bounce, etc.
- **Curvas de easing**: linear, easeIn, easeOut, easeInOut, bounce
- **Edição de efeitos na timeline**: arrastar para reposicionar, redimensionar pelas bordas, ou ajustar valores numéricos no painel
- **Atalhos de velocidade** (Lenta / Normal / Rápida) por efeito
- **Transições entre slides** com duração configurável
- **Preview ao hover** — passar o mouse sobre um efeito previa o canvas naquele instante
- **Menu de contexto** (botão direito) sobre um objeto mostra seus efeitos e permite preview

### IA — Gemini

- **Geração de imagens** a partir de prompt em texto
- **Edição de imagens** existentes a partir de instrução
- **Descrição de imagens** (image-to-text)
- Chave de API armazenada localmente; nunca enviada a outros servidores

### Tipografia

- **15+ fontes Google bundled** via `@fontsource` (carregam instantâneo, mesmo offline)
- **Modal "Adicionar Fonte"** que busca o catálogo completo do Google Fonts e baixa sob demanda
- Fontes recentes ficam no topo do seletor

### Arrastar e soltar

- Zonas de drop distintas: o canvas recebe imagens diretamente como objetos; o painel "Imagens" adiciona às Recentes sem colocar no canvas
- Suporta arrastar arquivos do Finder/Explorer (Tauri) e em modo navegador (fallback `File API`)

### Exportação

- **PNG** (slide atual)
- **PNG sequencial** (todos os slides em um zip)
- **MP4** (renderizado quadro a quadro com `MediaRecorder` para animações)
- **Projeto** `.sedp` (JSON portátil — slides, fundos, efeitos, imagens embutidas em base64)

---

## Stack

| Camada       | Tecnologia                                    |
| ------------ | --------------------------------------------- |
| Frontend     | Vue 3 (`<script setup>`) + TypeScript + Pinia |
| Canvas       | Fabric.js 6                                   |
| Runtime      | Tauri 2 (WebView2 / WKWebView / WebKitGTK)    |
| Backend      | Rust (`src-tauri/`)                           |
| Empacotador  | Vite 6                                        |
| Testes       | Vitest 3 + jsdom + @vue/test-utils            |
| Gerenciador  | Bun (npm também funciona)                     |

---

## Pré-requisitos

- **Bun** ≥ 1.0 (recomendado) ou **Node.js** ≥ 18
- **Rust** ≥ 1.78 com `rustup` (necessário para o backend Tauri)
- **Plataforma**:
  - macOS 11+ — Xcode Command Line Tools
  - Windows 10+ — Microsoft Edge WebView2 + Visual Studio Build Tools
  - Linux — `webkit2gtk-4.1`, `librsvg2-dev`, `build-essential`

Instale Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Instale Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Instalação

```bash
git clone https://github.com/JulielJordao/slide-canvas-editor.git
cd slide-canvas-editor
bun install
```

---

## Desenvolvimento

Roda o app desktop em modo dev com hot-reload (frontend + backend Rust):

```bash
bun run tauri dev
```

Ou apenas o frontend (no navegador, sem APIs nativas):

```bash
bun run dev
# Vite serve em http://localhost:1421
```

---

## Build de produção

Gera o instalador nativo da sua plataforma (`.dmg`, `.msi`, `.AppImage`, `.deb`):

```bash
bun run tauri build
```

Saídas:

- macOS — `src-tauri/target/release/bundle/dmg/Slide Editor_x.x.x_aarch64.dmg`
- Windows — `src-tauri/target/release/bundle/msi/Slide Editor_x.x.x_x64_en-US.msi`
- Linux — `src-tauri/target/release/bundle/appimage/slide-editor_x.x.x_amd64.AppImage`

---

## Configuração de chaves de API

A integração com Gemini é opcional. Para usá-la:

1. Obtenha uma chave em [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. No app, abra **IA (Gemini)** na barra lateral → clique no ícone de chave → cole sua chave
3. A chave fica salva localmente em `localStorage` — **nunca** é enviada para qualquer servidor exceto a API oficial do Google

Para os testes de integração (opcional):

```bash
# .env (não commitado)
VITE_GEMINI_API_KEY=sua_chave_aqui
```

---

## Atalhos de teclado

| Atalho                    | Ação                                |
| ------------------------- | ----------------------------------- |
| `Cmd/Ctrl + Z`            | Desfazer (inclui timeline)          |
| `Cmd/Ctrl + Shift + Z`    | Refazer                             |
| `Cmd/Ctrl + Y`            | Refazer (alternativa)               |
| `Cmd/Ctrl + D`            | Duplicar objeto selecionado         |
| `Cmd/Ctrl + A`            | Selecionar todos os objetos         |
| `Delete` / `Backspace`    | Remover objeto(s) selecionado(s)    |
| `Espaço`                  | Play / Pause no modo Animação       |
| `Esc`                     | Fechar modal aberto                 |
| Botão direito no canvas   | Preview de efeitos do objeto        |

---

## Estrutura do projeto

```
slide-canvas-editor/
├── src/
│   ├── App.vue                       # Layout principal
│   ├── main.ts                       # Bootstrap do Vue/Pinia
│   ├── style.css                     # Estilos globais + tokens
│   ├── types/                        # Tipos compartilhados
│   ├── stores/                       # Pinia (Composition API)
│   │   ├── slides.ts                 # Slides, efeitos, transições
│   │   ├── animation.ts              # Estado do playback / timeline
│   │   ├── canvas.ts                 # Seleção, crop, zoom
│   │   ├── history.ts                # Pilha undo/redo por slide
│   │   ├── settings.ts               # Fontes recentes, prefs
│   │   └── ui.ts                     # Tabs, modais
│   ├── composables/
│   │   ├── useFabricCanvas.ts        # Init/dispose Fabric, history snapshots
│   │   ├── useAnimation.ts           # Loop de animação, applyTimeMs()
│   │   ├── useCanvasBackground.ts    # Solid/gradient/image/video
│   │   ├── useDragDrop.ts            # Sistema multi-zona de drop
│   │   ├── useExport.ts              # PNG/MP4/projeto
│   │   ├── useAutoSave.ts            # Persistência periódica
│   │   ├── useGoogleFonts.ts         # Metadados Google Fonts
│   │   ├── useGeminiAI.ts            # Gemini image gen/edit/describe
│   │   └── useThumbnails.ts          # Geração de miniaturas
│   ├── components/
│   │   ├── canvas/                   # SlideCanvas, ContextToolbar, CropOverlay
│   │   ├── sidebar/                  # SlidesPanel, ImagesPanel, TextPanel...
│   │   ├── timeline/                 # TimelinePanel, AnimationEffectsPanel
│   │   ├── inspector/                # InspectorPanel, LayerPanel
│   │   ├── modals/                   # ExportModal, FontsModal, GeminiKeyModal
│   │   ├── toolbar/                  # TopToolbar
│   │   └── shared/                   # FontPicker, color pickers, etc.
│   ├── utils/                        # selectionColor, fontLoader, aspectRatio…
│   └── __tests__/                    # Testes Vitest organizados por área
├── src-tauri/
│   ├── Cargo.toml                    # Crate Rust
│   ├── tauri.conf.json               # Janela, CSP, bundling
│   ├── src/main.rs                   # Entrada do backend
│   └── icons/                        # Ícones do app
├── public/                           # Assets estáticos
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Arquitetura e decisões

### Reatividade

- **Pinia** com Composition API. Cada store é um `defineStore(id, () => …)` retornando refs/funções.
- **Snapshots de histórico** combinam o JSON do Fabric **e** o estado de animação do slide ativo, num único JSON serializável. Isso permite que `Cmd+Z` desfaça mudanças de timeline.

### Renderização do canvas

- Uma única instância de `fabric.Canvas` é compartilhada via `(window as any).__slideEditorCanvas` para evitar prop drilling em componentes fora da hierarquia.
- Eventos `object:added`/`object:modified`/`object:removed` agendam push de histórico em `setTimeout(300ms)` para colapsar mudanças rápidas (ex: digitação).
- Durante `loadFromJSON` (undo/redo), um flag `isApplyingHistory` suprime esses pushes — caso contrário, o `future` stack seria limpo após cada undo, quebrando o redo.

### Sistema de drop multi-zona

- `useDropZone(el, onDrop)` registra um elemento no registro global.
- Um único listener `tauri://drag-drop` no nível do composable usa a posição do cursor para escolher exatamente **uma** zona e chama seu handler com coordenadas locais.
- Cada zona expõe `isOver` reativo para destacar sozinha — sem overlay fullscreen.

### Fontes

- 15 famílias populares (Inter, Roboto, Montserrat, Playfair Display, etc.) entram no bundle via `@fontsource/*` para uso instantâneo offline.
- Para outras fontes, o modal **Adicionar Fonte** consulta `fonts.google.com/metadata/fonts` (sem necessidade de chave de API) — strip do prefixo XSSI `)]}'` e parsing da lista familiar.

### Animação

- A função `applyTimeMs(ms)` percorre cada objeto e calcula seu estado (transform / opacity / etc.) interpolando todos os efeitos ativos naquele instante.
- O loop de playback usa `requestAnimationFrame`. Em pause, ao voltar a `0ms`, restaura o estado original direto do cache em vez de re-aplicar — fix para o bug de "timeline drag apaga o canvas".

### Cores de seleção adaptativas

- `getSelectionColors(background)` calcula a luminância WCAG do fundo. Acima de **0.40** → handles escuros (`#312e81`); abaixo → claros (`#ffffff`); imagens/vídeos → indigo neutro (`#6366f1`).

### Drag de textarea (fix WKWebView)

- O Fabric.js cria um `<textarea data-fabric="textarea">` no `document.body` para capturar teclado durante edição. WKWebView panava a viewport ao focá-lo.
- Solução: regra CSS global com `!important` força `position: fixed; top: 0; left: 0; 1×1px; opacity: 0` antes do focus — WKWebView nunca precisa rolar.

---

## Testes

```bash
bun run test         # Roda todos os testes uma vez
bun run test:watch   # Watch mode
```

Cobertura atual: **182 testes passando** em 10 arquivos. Áreas cobertas:

- `stores/animation.test.ts` — playback state, seek, modos
- `stores/slides.test.ts` — slides, efeitos, transições, reordenação
- `composables/animationEffects.test.ts` — `computeEffect` para cada tipo
- `composables/timeline.test.ts` — conversão tempo↔pixel, ruler marks
- `composables/effectSpeed.test.ts` — presets de velocidade, mid-effect preview
- `composables/googleFonts.test.ts` — search, parsing da metadata API
- `utils/selectionColor.test.ts` — luminância e thresholds WCAG
- `components/imagePicker.test.ts` — single-add invariant e lifecycle de listeners
- `components/layerPanel.test.ts` — math de display↔canvas index, retry de listeners
- `integration/gemini.integration.test.ts` — pulado por padrão; rodar com `VITE_GEMINI_API_KEY` setado

---

## Formato de arquivo `.sedp`

Arquivos de projeto são JSON UTF-8 portáteis:

```jsonc
{
  "version": 1,
  "aspectRatio": { "label": "16:9", "width": 1920, "height": 1080 },
  "slides": [
    {
      "id": "abc123",
      "fabricJSON": "{...}",        // Estado do canvas serializado
      "background": { "type": "solid", "color": "#0f0f17" },
      "animation": {
        "durationMs": 5000,
        "effects": [
          { "id": "e1", "objectId": "obj1", "type": "fadeIn",
            "startMs": 0, "durationMs": 600, "easing": "easeOut" }
        ],
        "outTransition": { "type": "fade", "durationMs": 500 }
      },
      "thumbnailDataUrl": "data:image/png;base64,..."
    }
  ]
}
```

Imagens locais são incorporadas como data URLs dentro de `fabricJSON`, então um `.sedp` é autônomo — pode ser compartilhado sem arquivos externos.

---

## Solução de problemas

| Sintoma                                                        | Causa / solução                                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `bun run tauri dev` falha com `error: linker 'cc' not found`   | Linux: instale `build-essential`. macOS: rode `xcode-select --install`.                                          |
| Imagens não aparecem ao soltar no canvas                       | Verifique se o arquivo está dentro de uma das extensões suportadas (`png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`). |
| Fonte não carrega no modal "Adicionar Fonte"                   | Verifique conexão; o app cai pra lista bundled automaticamente se a API estiver indisponível.                     |
| Gemini retorna 403                                             | Chave inválida ou cota esgotada. Verifique em [aistudio.google.com](https://aistudio.google.com/app/apikey).      |
| Edição de texto rola a viewport (WKWebView macOS)              | Já corrigido via CSS — se reaparecer, verifique se `style.css` foi carregado.                                     |

---

## Roadmap

- [ ] Export GIF animado
- [ ] Camadas / grupos de objetos
- [ ] Templates pré-prontos por categoria
- [ ] Colaboração em tempo real
- [ ] PWA build (web-only fallback)
- [ ] Atalhos customizáveis

---

## Licença

[MIT](LICENSE) © 2026 Juliel Jordão
