# University Management System — Project Context for Claude Code

> Этот файл читается автоматически при каждом запуске Claude Code.
> Не удалять. Обновлять по мере развития проекта.

---

## Расположение проекта

```
C:\Users\user\.gemini\antigravity\scratch\university-system\
├── university-backend\      # NestJS API (порт 3000)
├── university-frontend\     # React + Vite (порт 5173)
├── scheduler-service\       # Python FastAPI (порт 8000)
└── docker-compose.yml       # Postgres, Redis, pgAdmin, MinIO
```

---

## Стек

| Слой | Технологии |
|---|---|
| Backend | NestJS + TypeScript + TypeORM + PostgreSQL |
| Frontend | React 18 + TypeScript + Vite + Ant Design + React Query + Zustand + Axios |
| Scheduler | Python 3 + FastAPI + DEAP |
| Infra | Docker Compose (postgres:15, redis, pgAdmin, MinIO) |

---

## Роли пользователей

```
admin   → управляет всей системой
teacher → свои дисциплины, расписание, журнал
student → своё расписание, оценки, GPA
```

**Система прав (RBAC) — спроектирована, НЕ реализована:**
```
User.is_super_admin: boolean  → главный admin, всё разрешено
AdminPermission { user_id, permission_code }  → делегированные права

Коды прав:
  schedule.input / schedule.generate / schedule.edit / schedule.publish
  structure.write / people.write / curriculum.write
  grades.write / grades.override
  exams.write / payments.write / analytics.view
  view.structure / view.people / view.curriculum / view.grades / view.exams
```

---

## Текущее состояние модулей

| Модуль | Готовность | Статус |
|---|---|---|
| Авторизация JWT | 90% | готов |
| Справочники (институты, кафедры, группы) | 85% | готов |
| Учебные планы (curriculum) | 75% | готов, есть нюансы |
| Расписание — сбор данных | 60% | в работе |
| Расписание — генерация (Python DEAP) | 55% | базовый работает |
| Расписание — версии и публикация | 60% | в работе |
| Расписание — ручной редактор drag&drop | 5% | не начато |
| Кабинет преподавателя | 40% | фундамент есть |
| Кабинет студента | 40% | фундамент есть |
| Экзамены | 50% | в работе |
| Оплаты | 45% | в работе |
| Аналитика | 40% | в работе |
| RBAC (система прав) | 10% | только спроектирована |

---

## Важные особенности системы

### Учебные планы
- Один `CurriculumItem` имеет ТРИ преподавателя: `teacher_lecture_id`, `teacher_practice_id`, `teacher_lab_id`
- Строки с нулевыми часами (hours=0) не показываются в UI
- Аудитории вводятся текстом (не FK), поле `preferred_classroom: string`

### Расписание — логика семестров
```typescript
// Курс и семестр вычисляются динамически:
course = startYear - group.year_of_entry + 1
semester = period === 'autumn' ? (course * 2 - 1) : (course * 2)
// Осень: 1к=1сем, 2к=3сем, 3к=5сем, 4к=7сем
// Весна: 1к=2сем, 2к=4сем, 3к=6сем, 4к=8сем
```

### Расписание — потоки
- `Stream` + `StreamGroup` — несколько групп на одной лекции у одного преподавателя
- Генерируется один ScheduleSlot для потока, но видно всем группам потока

### Python генератор — проблема аудиторий
- Аудитории передаются как текст (например "412"), без `capacity`
- Алгоритм НЕ должен проверять вместимость — использовать текст как жёсткую привязку
- Конфликт аудитории = одна аудитория в одно время у двух разных пар

---

## Тестовые данные (seed)

```
admin@university.edu    / admin123    → role: admin
teacher@university.edu  / teacher123  → role: teacher
student@university.edu  / student123  → role: student

Институт: ИИТ
Кафедра: Прикладная математика и информатика
Направление: Бизнес-информатика
Группы: БИ-1-22 (4к), БИ-2-22 (4к), БИ-3-22 (4к), БИ-1-23 (3к), БИ-1-24 (2к), БИ-1-25 (1к)
```

---

## Правила разработки в этом проекте

1. Не трогать существующие entity без явного указания
2. Все новые эндпоинты защищать через `@Roles('admin')` + `@UseGuards(JwtAuthGuard, RolesGuard)`
3. Возвращать единый формат: `{ data: T, message?: string }`
4. На фронте все запросы через React Query (`useQuery` / `useMutation`)
5. Компоненты в `pages/admin/`, `pages/teacher/`, `pages/student/`
6. Общие компоненты в `components/common/`
7. Новый модуль = новая папка в `src/modules/` со своим `.module.ts`, `.controller.ts`, `.service.ts`