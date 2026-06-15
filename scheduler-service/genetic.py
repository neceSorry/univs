import random
import copy
from collections import defaultdict
from deap import base, creator, tools, algorithms

# ────────────────────────────────────────────────
# GA Parameters
# ────────────────────────────────────────────────
POPULATION_SIZE = 120
GENERATIONS = 80
CROSSOVER_PROB = 0.7
MUTATION_PROB = 0.10
TOURNAMENT_SIZE = 3

# Iterated local search (post-GA refinement)
ILS_ROUNDS = 60        # perturb-and-reoptimise cycles
ILS_KICK_STRENGTH = 3  # genes randomly displaced per kick

DAYS = list(range(1, 7))   # 1=Mon … 6=Sat
PERIODS = list(range(1, 7)) # 1-6

WEEK_TYPES = ['all', 'odd', 'even']

def _week_types_conflict(a: str, b: str) -> bool:
    """Return True if two week_types can clash (both in same physical week)."""
    if a == 'odd' and b == 'even':
        return False
    if a == 'even' and b == 'odd':
        return False
    return True


# ────────────────────────────────────────────────
# Initialisation helpers
# ────────────────────────────────────────────────

def make_gene(item: dict, classrooms: list) -> dict:
    """Return a randomly initialised gene (lesson slot) for a curriculum item.

    classrooms param is kept for API compatibility but unused — classrooms are
    now text strings taken directly from the curriculum item's preferred_classroom.
    """
    # preferred_classroom is a text string (e.g. "412") or None
    classroom = item.get('preferred_classroom')
    return {
        'curriculum_item_id': item['id'],
        'group_id': item['group_id'],
        'discipline_id': item.get('discipline_id'),
        'teacher_id': item.get('teacher_id'),
        'lesson_type': item.get('lesson_type', 'lecture'),
        'classroom': classroom,  # text string or None
        'day_of_week': random.choice(DAYS),
        'period': random.choice(PERIODS),
        'week_type': item.get('week_type', 'all'),
        'is_stream': item.get('is_stream', False),
        'stream_id': item.get('stream_id'),
        'stream_group_ids': item.get('stream_group_ids', []),
    }


def random_individual(expanded_items: list, classrooms: list):
    genes = [make_gene(item, classrooms) for item in expanded_items]
    return creator.Individual(genes)


# ────────────────────────────────────────────────
# Fitness function
# ────────────────────────────────────────────────

def evaluate(individual, teacher_prefs: dict, weights: dict):
    penalty = 0

    # Hard conflict keys do NOT include week_type so 'all' vs 'odd'/'even' conflicts are caught
    teacher_slots = defaultdict(list)   # (teacher_id, day, period) → genes
    group_slots   = defaultdict(list)   # (group_id, day, period) → genes
    room_slots    = defaultdict(list)   # (classroom_str, day, period) → genes

    # Soft constraint data grouped by entity + day
    teacher_day_genes = defaultdict(lambda: defaultdict(list))  # tid → day → [gene]
    teacher_all_genes = defaultdict(list)                       # tid → [gene]
    group_day_genes   = defaultdict(lambda: defaultdict(list))  # gid → day → [gene]

    details = defaultdict(int)

    for gene in individual:
        day = gene['day_of_week']
        period = gene['period']
        tid = gene['teacher_id']
        classroom = gene['classroom']

        teacher_slots[(tid, day, period)].append(gene)
        teacher_day_genes[tid][day].append(gene)
        teacher_all_genes[tid].append(gene)

        if classroom is not None:
            room_slots[(classroom, day, period)].append(gene)

        gids = gene['stream_group_ids'] if gene.get('is_stream') else [gene['group_id']]
        for gid in gids:
            group_slots[(gid, day, period)].append(gene)
            group_day_genes[gid][day].append(gene)

    # ── 1. Hard: Teacher conflict ──
    for genes in teacher_slots.values():
        for i in range(len(genes)):
            for j in range(i + 1, len(genes)):
                if _week_types_conflict(genes[i]['week_type'], genes[j]['week_type']):
                    penalty += weights['hard_conflict']
                    details['hard_conflicts'] += 1

    # ── 2. Hard: Group conflict ──
    for genes in group_slots.values():
        for i in range(len(genes)):
            for j in range(i + 1, len(genes)):
                if _week_types_conflict(genes[i]['week_type'], genes[j]['week_type']):
                    penalty += weights['hard_conflict']
                    details['hard_conflicts'] += 1

    # ── 3. Hard: Classroom conflict ──
    for genes in room_slots.values():
        for i in range(len(genes)):
            for j in range(i + 1, len(genes)):
                if _week_types_conflict(genes[i]['week_type'], genes[j]['week_type']):
                    penalty += weights['hard_conflict']
                    details['hard_conflicts'] += 1

    # ── Teacher soft constraints — evaluated per week context (odd/even) ──
    for tid, day_map in teacher_day_genes.items():
        pref = teacher_prefs.get(tid, {})
        unavail  = set(pref.get('unavailable_days', []))
        preferred = set(pref.get('preferred_periods', []))
        max_day  = pref.get('max_periods_per_day', 4)

        for day, genes_list in day_map.items():
            for week_ctx in ('odd', 'even'):
                active = [g for g in genes_list
                          if g['week_type'] == 'all' or g['week_type'] == week_ctx]
                if not active:
                    continue
                periods = [g['period'] for g in active]

                if day in unavail:
                    penalty += weights['hard_conflict'] * len(periods)
                    details['hard_conflicts'] += len(periods)

                for p in periods:
                    if preferred and p not in preferred:
                        penalty += weights['teacher_preferred_time']
                        details['teacher_preferred_time_violations'] += 1

                if len(periods) > max_day:
                    excess = len(periods) - max_day
                    penalty += weights['teacher_overload'] * excess
                    details['teacher_overloads'] += excess

                sorted_p = sorted(set(periods))
                for i in range(1, len(sorted_p)):
                    gap = sorted_p[i] - sorted_p[i - 1]
                    if gap > 1:
                        penalty += weights['teacher_window'] * (gap - 1)
                        details['teacher_windows'] += gap - 1

    for tid, genes_list in teacher_all_genes.items():
        pref = teacher_prefs.get(tid, {})
        max_week = pref.get('max_periods_per_week', 9)
        for week_ctx in ('odd', 'even'):
            active_count = sum(
                1 for g in genes_list
                if g['week_type'] == 'all' or g['week_type'] == week_ctx
            )
            if active_count > max_week:
                penalty += weights['teacher_rate_exceeded'] * (active_count - max_week)
                details['teacher_rate_violations'] += active_count - max_week

    # ── Group soft constraints — evaluated per week context (odd/even) ──
    for gid, day_map in group_day_genes.items():
        for day, genes_list in day_map.items():
            for week_ctx in ('odd', 'even'):
                active_periods = sorted(set(
                    g['period'] for g in genes_list
                    if g['week_type'] == 'all' or g['week_type'] == week_ctx
                ))
                if not active_periods:
                    continue

                if len(active_periods) > 4:
                    excess = len(active_periods) - 4
                    penalty += weights['group_overload'] * excess
                    details['group_overloads'] += excess

                for i in range(1, len(active_periods)):
                    gap = active_periods[i] - active_periods[i - 1]
                    if gap > 1:
                        penalty += weights['group_window'] * (gap - 1)
                        details['group_windows'] += gap - 1

                if len(active_periods) == 1:
                    penalty += weights.get('group_single_lesson', 400)
                    details['group_single_lessons'] += 1
                    if active_periods[0] >= 4:
                        penalty += weights.get('group_late_single', 200)
                        details['group_late_singles'] += 1

    return (penalty,), details


# ────────────────────────────────────────────────
# Local search (hill-climbing) — deterministic post-processing.
# GA gives a good rough solution; this step greedily moves each lesson
# to the (day, period) that minimises total penalty, which reliably
# eliminates windows and single-lesson days that the GA leaves behind.
# ────────────────────────────────────────────────

def _penalty_carrying_indices(individual):
    """Indices of genes that sit on a group's window/single/overloaded day.
    These are the lessons worth relocating; everything else is already fine."""
    group_day_idx = defaultdict(lambda: defaultdict(list))  # gid → day → [idx]
    for i, gene in enumerate(individual):
        gids = gene['stream_group_ids'] if gene.get('is_stream') else [gene['group_id']]
        for gid in gids:
            group_day_idx[gid][gene['day_of_week']].append(i)

    flagged = set()
    for gid, day_map in group_day_idx.items():
        for day, idxs in day_map.items():
            periods = sorted(individual[i]['period'] for i in idxs)
            has_window = any(periods[k] - periods[k - 1] > 1 for k in range(1, len(periods)))
            if len(idxs) == 1 or len(idxs) > 4 or has_window:
                flagged.update(idxs)
    return flagged


def _sweep(individual, indices, teacher_prefs, weights, best_penalty):
    """One hill-climbing pass over the given gene indices. Returns (penalty, improved)."""
    improved = False
    for idx in indices:
        gene = individual[idx]
        orig = (gene['day_of_week'], gene['period'])
        best_dp = orig
        for day in DAYS:
            for period in PERIODS:
                if (day, period) == orig:
                    continue
                gene['day_of_week'] = day
                gene['period'] = period
                p = evaluate(individual, teacher_prefs, weights)[0][0]
                if p < best_penalty:
                    best_penalty = p
                    best_dp = (day, period)
        gene['day_of_week'], gene['period'] = best_dp
        if best_dp != orig:
            improved = True
    return best_penalty, improved


def _swap_sweep(individual, indices, teacher_prefs, weights, best_penalty):
    """Try swapping (day,period) of each flagged gene with every other gene.
    Swaps are moves single-gene relocation cannot make and they unstick the
    plateaus caused by odd/even weeks being scored together."""
    improved = False
    n = len(individual)
    for idx in indices:
        gi = individual[idx]
        for j in range(n):
            if j == idx:
                continue
            gj = individual[j]
            gi_dp = (gi['day_of_week'], gi['period'])
            gj_dp = (gj['day_of_week'], gj['period'])
            if gi_dp == gj_dp:
                continue
            gi['day_of_week'], gi['period'] = gj_dp
            gj['day_of_week'], gj['period'] = gi_dp
            p = evaluate(individual, teacher_prefs, weights)[0][0]
            if p < best_penalty:
                best_penalty = p
                improved = True
            else:
                gi['day_of_week'], gi['period'] = gi_dp
                gj['day_of_week'], gj['period'] = gj_dp
    return best_penalty, improved


def local_optimize(individual, teacher_prefs: dict, weights: dict, max_passes: int = 40):
    best_penalty = evaluate(individual, teacher_prefs, weights)[0][0]
    all_idx = list(range(len(individual)))

    for _ in range(max_passes):
        # Phase 1: cheap targeted relocation of genes on bad days.
        targets = _penalty_carrying_indices(individual)
        if not targets:
            break
        best_penalty, improved = _sweep(individual, targets, teacher_prefs, weights, best_penalty)
        if improved:
            continue
        # Phase 2: full relocation sweep — frees an adjacent slot for a stuck lesson.
        best_penalty, improved = _sweep(individual, all_idx, teacher_prefs, weights, best_penalty)
        if improved:
            continue
        # Phase 3: swap moves between the stuck lessons and the rest.
        best_penalty, improved = _swap_sweep(individual, targets, teacher_prefs, weights, best_penalty)
        if not improved:
            break

    return individual, best_penalty


def iterated_local_search(individual, teacher_prefs: dict, weights: dict):
    """ILS: local search is cheap (~0.1s) but gets stuck. Repeatedly kick a few
    genes out of place and re-optimise, keeping the best result found. This is
    what actually drives group windows / single-lesson days down to zero."""
    best, best_pen = local_optimize(individual, teacher_prefs, weights)
    best_snapshot = copy.deepcopy(list(best))

    for _ in range(ILS_ROUNDS):
        # Only soft penalties are worth chasing; hard conflicts are handled by GA.
        _, det = evaluate(best, teacher_prefs, weights)
        soft_issues = (det.get('group_windows', 0) + det.get('group_single_lessons', 0)
                       + det.get('group_overloads', 0))
        if soft_issues == 0:
            break

        candidate = creator.Individual(copy.deepcopy(best_snapshot))
        flagged = list(_penalty_carrying_indices(candidate)) or list(range(len(candidate)))
        for kidx in random.sample(flagged, min(ILS_KICK_STRENGTH, len(flagged))):
            candidate[kidx]['day_of_week'] = random.choice(DAYS)
            candidate[kidx]['period'] = random.choice(PERIODS)

        candidate, pen = local_optimize(candidate, teacher_prefs, weights)
        if pen < best_pen:
            best_pen = pen
            best = candidate
            best_snapshot = copy.deepcopy(list(candidate))

    return best, best_pen


# ────────────────────────────────────────────────
# Mutation — only day/period, classroom is a hard constraint from curriculum
# ────────────────────────────────────────────────

def mutate(individual, classrooms: list):
    if not individual:
        return (individual,)

    # 40% chance: targeted compaction — move a lonely lesson to a busy day
    if random.random() < 0.4:
        group_day_map = defaultdict(lambda: defaultdict(list))
        for i, gene in enumerate(individual):
            gids = gene['stream_group_ids'] if gene.get('is_stream') else [gene['group_id']]
            for gid in gids:
                group_day_map[gid][gene['day_of_week']].append(i)

        lonely = []
        for gid, day_map in group_day_map.items():
            for day, indices in day_map.items():
                if len(indices) == 1:
                    lonely.append((gid, day, indices[0]))

        if lonely:
            _, _, idx = random.choice(lonely)
            gene = individual[idx]
            gid = gene['group_id']
            busy_days = [d for d, idxs in group_day_map.get(gid, {}).items()
                         if d != gene['day_of_week'] and len(idxs) > 1]
            if busy_days:
                gene['day_of_week'] = random.choice(busy_days)
                return (individual,)

    # 20% chance: close a window — move the later half of a gapped day earlier
    if random.random() < 0.2:
        group_day_map = defaultdict(lambda: defaultdict(list))
        for i, gene in enumerate(individual):
            gids = gene['stream_group_ids'] if gene.get('is_stream') else [gene['group_id']]
            for gid in gids:
                group_day_map[gid][gene['day_of_week']].append(i)

        gapped = []
        for gid, day_map in group_day_map.items():
            for day, indices in day_map.items():
                if len(indices) < 2:
                    continue
                periods = sorted(individual[i]['period'] for i in indices)
                for k in range(1, len(periods)):
                    if periods[k] - periods[k - 1] > 1:
                        gapped.append((gid, day, indices, periods[k]))

        if gapped:
            gid, day, indices, gap_period = random.choice(gapped)
            for i in indices:
                if individual[i]['period'] == gap_period:
                    individual[i]['period'] = max(1, gap_period - 1)
                    return (individual,)

    # Default: random day or period shift
    idx = random.randint(0, len(individual) - 1)
    gene = individual[idx]
    if random.random() < 0.5:
        gene['day_of_week'] = random.choice(DAYS)
    else:
        gene['period'] = random.choice(PERIODS)
    return (individual,)


# ────────────────────────────────────────────────
# Two-point crossover on gene list
# ────────────────────────────────────────────────

def crossover(ind1, ind2):
    size = min(len(ind1), len(ind2))
    if size < 2:
        return ind1, ind2
    pt1 = random.randint(0, size - 2)
    pt2 = random.randint(pt1 + 1, size - 1)
    ind1[pt1:pt2], ind2[pt1:pt2] = ind2[pt1:pt2], ind1[pt1:pt2]
    return ind1, ind2


# ────────────────────────────────────────────────
# Public API — called from main.py
# ────────────────────────────────────────────────

def generate_schedule(data: dict) -> dict:
    """
    data keys: curriculum_items, teacher_preferences, weights
    classrooms key is ignored (classrooms are now text strings in curriculum_items)
    Returns: { quality_score, penalty_details, slots }
    """
    curriculum_items: list = data.get('curriculum_items', [])
    classrooms: list = []  # no longer used — kept for backward compat
    raw_prefs: list = data.get('teacher_preferences', [])
    weights: dict = data.get('weights', {})

    default_weights = {
        'teacher_window': 20,
        'teacher_overload': 30,
        'teacher_preferred_time': 10,
        'teacher_rate_exceeded': 50,
        'group_window': 220,
        'group_overload': 25,
        'group_single_lesson': 700,
        'group_late_single': 200,
        'hard_conflict': 1000,
    }
    w = {**default_weights, **weights}

    # Convert prefs list → dict keyed by teacher_id
    teacher_prefs = {p['teacher_id']: p for p in raw_prefs}

    # Expand curriculum_items into per-lesson-type items
    expanded = []
    for item in curriculum_items:
        teacher_lecture_id  = item.get('teacher_lecture_id')  or item.get('teacher_id')
        teacher_practice_id = item.get('teacher_practice_id') or item.get('teacher_id')
        teacher_lab_id      = item.get('teacher_lab_id')      or item.get('teacher_id')

        lecture_hours  = max(0, item.get('hours_lecture', 0))
        practice_hours = max(0, item.get('hours_practice', 0))
        lab_hours      = max(0, item.get('hours_lab', 0))

        def week_types_for_hours(h: float) -> list:
            # 2h/session × 18 weeks = 36 → sessions per week
            # 36h → [all], 54h → [all, odd], 18h → [odd], 72h → [all, all]
            if h <= 0:
                return []
            per_week = h / 36.0
            base = int(per_week)
            result = ['all'] * base
            if per_week - base >= 0.5:
                result.append('odd')
            return result or ['odd']

        if teacher_lecture_id and lecture_hours > 0:
            for wt in week_types_for_hours(lecture_hours):
                expanded.append({
                    **copy.deepcopy(item),
                    'teacher_id': teacher_lecture_id,
                    'lesson_type': 'lecture',
                    'week_type': wt,
                    'preferred_classroom': item.get('preferred_classroom_lecture') or item.get('preferred_classroom'),
                })

        if teacher_practice_id and practice_hours > 0:
            for wt in week_types_for_hours(practice_hours):
                expanded.append({
                    **copy.deepcopy(item),
                    'teacher_id': teacher_practice_id,
                    'lesson_type': 'practice',
                    'week_type': wt,
                    'preferred_classroom': item.get('preferred_classroom_practice') or item.get('preferred_classroom'),
                })

        if teacher_lab_id and lab_hours > 0:
            for wt in week_types_for_hours(lab_hours):
                expanded.append({
                    **copy.deepcopy(item),
                    'teacher_id': teacher_lab_id,
                    'lesson_type': 'lab',
                    'week_type': wt,
                    'preferred_classroom': item.get('preferred_classroom_lab') or item.get('preferred_classroom'),
                })

    if not expanded:
        return {
            'quality_score': 100,
            'penalty_details': {},
            'slots': [],
        }

    # DEAP setup (safe for re-import)
    if not hasattr(creator, 'FitnessMin'):
        creator.create('FitnessMin', base.Fitness, weights=(-1.0,))
    if not hasattr(creator, 'Individual'):
        creator.create('Individual', list, fitness=creator.FitnessMin)

    toolbox = base.Toolbox()
    toolbox.register('individual', random_individual, expanded, classrooms)
    toolbox.register('population', tools.initRepeat, list, toolbox.individual)
    toolbox.register('evaluate', lambda ind: evaluate(ind, teacher_prefs, w)[0])
    toolbox.register('mate', crossover)
    toolbox.register('mutate', mutate, classrooms=classrooms)
    toolbox.register('select', tools.selTournament, tournsize=TOURNAMENT_SIZE)

    pop = toolbox.population(n=POPULATION_SIZE)
    hof = tools.HallOfFame(1)

    algorithms.eaSimple(
        pop, toolbox,
        cxpb=CROSSOVER_PROB,
        mutpb=MUTATION_PROB,
        ngen=GENERATIONS,
        halloffame=hof,
        verbose=False,
    )

    best = hof[0]

    # Memetic refinement: iterated local search removes the windows /
    # single-lesson days the GA leaves behind.
    best, _ = iterated_local_search(best, teacher_prefs, w)

    best_penalty, details = evaluate(best, teacher_prefs, w)
    penalty_val = best_penalty[0]

    # Compute quality score 0-100.
    # Hard conflicts dominate; the remaining soft penalty is scaled against a
    # realistic per-lesson budget so windows/singles actually move the score.
    n = len(best)
    hard = details.get('hard_conflicts', 0)
    soft_penalty = penalty_val - hard * w['hard_conflict']
    soft_budget = max(1, n * w['group_window'])
    quality = 100
    quality -= min(100, hard * 100)                       # any hard conflict tanks the score
    quality -= min(40, round(soft_penalty / soft_budget * 100))  # soft issues cost up to 40
    quality = max(0, quality)

    slots = []
    for gene in best:
        slots.append({
            'curriculum_item_id': gene['curriculum_item_id'],
            'group_id': gene['group_id'],
            'discipline_id': gene['discipline_id'],
            'teacher_id': gene['teacher_id'],
            'classroom': gene.get('classroom'),  # text string or None
            'lesson_type': gene.get('lesson_type', 'lecture'),
            'day_of_week': gene['day_of_week'],
            'period': gene['period'],
            'week_type': gene['week_type'],
            'is_stream': gene.get('is_stream', False),
            'stream_id': gene.get('stream_id'),
            'stream_group_ids': gene.get('stream_group_ids', []),
        })

    return {
        'quality_score': quality,
        'penalty_details': dict(details),
        'slots': slots,
    }
