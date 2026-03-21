# Project Overview

**專案名稱：** [Bookmark_system]
**GitHub：** [https://github.com/frankLKU/bookmark_system]

## 技術棧
- **Frontend：** React
- **Backend：** Python / FastAPI
- **測試：** pytest（backend）、Jest + React Testing Library（frontend）
- **版本控制：** Git + GitHub PR flow

## 專案結構
```
├── CLAUDE.md
├── .claude/agents/        ← 各角色 skill 設定
├── docs/
│   ├── prd/               ← PM 輸出的需求文件（.md）
│   └── designs/           ← Designer 輸出的 UI 規格（.md）
├── frontend/              ← React 專案
│   └── src/
├── backend/               ← FastAPI 專案
│   └── app/
└── tests/                 ← QA 測試案例
```

## Branch 規範
- `main` — 穩定版本，不直接 push
- `feature/[功能名稱]` — 新功能開發
- `fix/[bug名稱]` — 修復 bug
- 所有合併必須透過 PR，並由 Team Lead 審核

## API 介面規範
- RESTful API，prefix 統一用 `/api/v1/`
- 回傳格式：`{ "data": ..., "message": "...", "code": true/false }`
- Frontend 與 Backend 在開始實作前，必須先在 `docs/designs/api-[功能名稱].md` 中確認 API 介面

## 工作流程
1. **Team Lead** 接收需求，分配給 PM
2. **PM** 撰寫 PRD，輸出到 `docs/prd/[功能名稱].md`
3. **Designer** 根據 PRD 設計 UI，輸出到 `docs/designs/[功能名稱].md`
4. **Frontend + Backend** 同步開始，先對齊 API 介面，再各自實作
5. **QA** 根據 PRD 和實作撰寫測試，執行並回報結果
6. **Team Lead** 整合所有結果，發 PR 到 main
