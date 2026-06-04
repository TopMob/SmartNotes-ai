# Интерфейс, Анимации и Drag-and-Drop (UI, Animations & Drag-and-Drop)

Внешний вид и поведение интерфейса SmartNotes AI построены на принципах высокой отзывчивости, локального отклика (Optimistic UI) и плавных переходов. Для этого используются **Zustand** (управление состоянием), **Framer Motion** (анимации), и **@dnd-kit** (Drag-and-Drop).

---

## 1. Управление состоянием интерфейса (`useUiStore`)

Глобальное состояние интерфейса (активный экран, поисковые запросы, фильтры, состояние боковых панелей) хранится в Zustand-сторе [ui-store.ts](../../SmartNotes-web/src/shared/store/ui-store.ts):

- **Режимы отображения (`AppView`):** Приложение поддерживает переключение между экранами: `notes`, `favorites`, `archive`, `folder`, `folders`, `reminders`, `locked`, `trash`, `invites` и `admin_tools`.
- **Фильтрация заметок (`notesFilter`):** Хранит состояние выбранных тегов, папок, сортировки и временного окна обновлений (`NotesFilter`). Поддерживает создание именованных фильтров пользователя (до 12 штук) с сохранением в `localStorage`.
- **Developer Mode:** Позволяет переключать отладочные режимы, сохраняя состояние в локальное хранилище браузера (`smartnotes:developer_mode`).

---

## 2. Анимации и Переходы (Framer Motion)

Для создания премиального UX используются микроанимации и сложные переходы, описанные с помощью библиотеки `framer-motion`:

### Анимация AI-Чата ([AiChatPanel.tsx](../../SmartNotes-web/src/features/ai-engine/ui/AiChatPanel.tsx))
- **Backdrop (Размытый фон):** При открытии чата на мобильных устройствах плавно появляется полупрозрачная подложка с эффектом `backdrop-blur-xs` (анимируется `opacity` от 0 до 1 через `AnimatePresence`).
- **Слайд-панель:** Чат выезжает справа с использованием плавной кастомной кривой Безье:
  ```typescript
  transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
  ```
  Для оптимизации производительности рендеринга на мобильных устройствах применяется свойство `willChange: "transform, opacity"`.

### Динамические списки сообщений ([ChatMessageList.tsx](../../SmartNotes-web/src/features/ai-engine/ui/components/ChatMessageList.tsx))
- **Staggered Entrance (Каскадный вход):** Приветственные подсказки и сообщения появляются по очереди с небольшой задержкой (эффект stagger в 0.08 секунд):
  ```typescript
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };
  ```
- **Элементы управления:** Подсказки в чате имеют микро-интерактивность на наведение (`whileHover={{ scale: 1.02, translateY: -1 }}`) и нажатие (`whileTap={{ scale: 0.98 }}`).

### Холст рисования ([DrawingCanvas.tsx](../../SmartNotes-web/src/features/editor/ui/DrawingCanvas.tsx))
- Панель инструментов плавно выезжает сверху (`initial={{ y: -20, opacity: 0 }}`), а кнопки управления — снизу (`initial={{ y: 20, opacity: 0 }}`), создавая ощущение фокуса на процессе рисования.

---

## 3. Сортировка и Drag-and-Drop (@dnd-kit)

Сортировка элементов интерфейса реализована с использованием современного набора инструментов `@dnd-kit/core` и `@dnd-kit/sortable`. 

### Сортировка заметок в сетке/списке ([MainSurface.tsx](../../SmartNotes-web/src/features/app-shell/ui/components/MainSurface.tsx))
- Обернута в `<DndContext>` с сенсорами `PointerSensor` и `KeyboardSensor`.
- Использует стратегию поиска столкновений `closestCenter`.
- При завершении перетаскивания (`onDragEnd`) генерируется событие `handleDragEnd`, которое рассчитывает новый индекс и вызывает мутацию изменения порядка заметок в базе данных.
- Карточка заметки ([NoteCard.tsx](../../SmartNotes-web/src/features/app-shell/ui/components/NoteCard.tsx)) использует хук `useSortable`. Во время перетаскивания ее прозрачность снижается до 0.3, а `zIndex` принудительно выставляется в 50 для перекрытия соседних элементов.

### Сортировка папок в боковой панели ([Sidebar.tsx](../../SmartNotes-web/src/features/app-shell/ui/components/Sidebar.tsx))
- Работает по аналогичной схеме с использованием `useSortable`. Позволяет пользователям вручную менять приоритет и порядок папок в дереве навигации.

---

## 4. Адаптивность и мобильная клавиатура (`useVisualViewportKeyboard`)

Одной из сложнейших проблем веб-приложений (особенно в Safari на iOS) является некорректное поведение `100vh` при открытии виртуальной клавиатуры, из-за чего нижняя часть редактора и футер с кнопками сохранения оказываются перекрыты.

Для решения этой проблемы используется кастомный хук [useVisualViewportKeyboard.ts](../../SmartNotes-web/src/features/app-shell/ui/hooks/use-visual-viewport-keyboard.ts):
1. Он слушает события `resize` и `scroll` на объекте `window.visualViewport`.
2. При изменении размеров экрана (появление клавиатуры) хук динамически вычисляет реальную доступную высоту `window.visualViewport.height`.
3. Устанавливает CSS-переменную `--vv-height` на уровне корневого элемента:
   ```typescript
   document.documentElement.style.setProperty("--vv-height", `${viewport.height}px`);
   ```
4. Компонент редактора использует эту переменную для ограничения своей высоты (`h-[var(--vv-height,100dvh)]`), гарантируя, что футер и кнопки всегда будут находиться непосредственно над клавиатурой.
