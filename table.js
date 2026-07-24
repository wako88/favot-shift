/* ===========================
   Favot Shift Ver1.0
   table.js
=========================== */

const SHIFT_MASTER = [
    "",
    "早①",
    "早②",
    "遅",
    "夜①",
    "夜②",
    "休",
    "有"
];

const SHIFT_DISPLAY_NAMES = {
    "早①": "早",
    "夜①": "夜"
};

function getShiftDisplayName(shift) {
    return SHIFT_DISPLAY_NAMES[shift] || shift || "";
}

const COUNT_COLUMNS = [
    { key: "early", label: "早", className: "earlyCount" },
    { key: "late", label: "遅", className: "lateCount" },
    { key: "night", label: "夜", className: "nightCount" },
    { key: "rest", label: "休", className: "restCount" }
];

const AUTO_SHIFT_CONFIG = {
    minRestDays: 8,
    maxRestDays: 9,
    minCategoryCount: 7,
    maxCategoryCount: 9,
    minEarlyCount: 7,
    maxEarlyCount: 9,
    minNightCount: 7,
    maxNightCount: 8,
    minLateCount: 6,
    maxLateCount: 7,
    targetLateCount: 7,
    maxConsecutiveWorkDays: 5,
    targetConsecutiveRest: 2,
    largeImbalanceThreshold: 3,
    nightBeforeWeekendLowCountWeight: 18,
    searchAttempts: 12
};

function buildTable() {

    const [year, month] = monthSelect.value.split("-");
    const days = new Date(year, month, 0).getDate();

    createHeader(year, month, days);
    createBody(days);
    attachCellEvents();
    updateCount();
    clearAutoWarnings();

}

function createHeader(year, month, days) {

    let html = `
        <tr>
            <th class="staffHeaderCell stickyLeft">スタッフ</th>
    `;

    for (let day = 1; day <= days; day++) {

        const date = new Date(year, month - 1, day);
        const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];

        let cls = "";
        if (date.getDay() === 6) cls = "sat";
        if (date.getDay() === 0) cls = "sun";

        html += `
            <th class="dateHeaderCell ${cls}">
                ${day}
                <small>${week}</small>
            </th>
        `;

    }

    COUNT_COLUMNS.forEach(column => {

        html += `
            <th class="countHeaderCell ${column.className}">
                ${column.label}
            </th>
        `;

    });

    html += `
        </tr>
    `;

    shiftHead.innerHTML = html;

}

function createBody(days) {

    let html = "";
    const activeStaff = staffList.filter(staff => staff.enabled);

    activeStaff.forEach(staff => {

        html += `
            <tr data-id="${staff.id}">
                <th class="staffCell stickyLeft">${staff.name}</th>
        `;

        for (let day = 1; day <= days; day++) {

            html += `
                <td class="shiftCell" data-shift=""></td>
            `;

        }

        COUNT_COLUMNS.forEach(column => {

            html += `
                <td class="countCell ${column.className}">0</td>
            `;

        });

        html += `
            </tr>
        `;

    });

    shiftBody.innerHTML = html;

}

function attachCellEvents() {

    const cells = document.querySelectorAll("#shiftBody td[data-shift]");

    cells.forEach(cell => {

        cell.addEventListener("click", () => {

            let current = cell.dataset.shift;
            let index = SHIFT_MASTER.indexOf(current);

            index++;
            if (index >= SHIFT_MASTER.length) index = 0;

            current = SHIFT_MASTER[index];
            cell.dataset.shift = current;
            cell.textContent = getShiftDisplayName(current);

            cell.classList.remove("autoAssignedCell", "autoWarningCell");
            delete cell.dataset.autoAssigned;

            if (current) {
                cell.dataset.source = "manual";
            } else {
                delete cell.dataset.source;
            }

            updateCount();
            clearAutoWarnings();
            saveData();

        });

    });

}

function updateCount() {

    document.querySelectorAll("#shiftBody tr").forEach(row => {

        const counts = getEmptyCounts();

        row.querySelectorAll("td[data-shift]").forEach(cell => {
            addShiftToCounts(counts, cell.dataset.shift);
        });

        row.querySelector(".earlyCount").textContent = counts.early;
        row.querySelector(".lateCount").textContent = counts.late;
        row.querySelector(".nightCount").textContent = counts.night;
        row.querySelector(".restCount").textContent = counts.rest;

    });

}

function createAutoShift() {

    const bestPlan = findBestAutoShiftPlan();
    const context = createAutoShiftContext();

    if (context.staffStates.length === 0) {
        showAutoWarnings(["自動作成対象の社員がいません。スタッフ管理で自動対象を確認してください。"]);
        return;
    }

    applyShiftPlan(context, bestPlan);
    writeAutoShiftToTable(context);

    updateCount();

    const warnings = validateAutoShift(context);
    showAutoWarnings(warnings);
    saveData();

}

function findBestAutoShiftPlan() {

    let bestPlan = null;
    const attempts = [];

    for (let attempt = 0; attempt < AUTO_SHIFT_CONFIG.searchAttempts; attempt++) {

        clearAutoAssignedCells();
        const context = createAutoShiftContext(attempt);

        if (context.staffStates.length === 0) {
            return captureShiftPlan(context);
        }

        buildAutoShiftPlan(context);
        const plan = captureShiftPlan(context);
        attempts.push(plan);

        if (!bestPlan || comparePlanScore(plan.score, bestPlan.score) < 0) {
            bestPlan = plan;
        }

    }

    clearAutoAssignedCells();
    const summary = {
        selectedAttempt: bestPlan ? bestPlan.attempt : null,
        uniquePatterns: new Set(attempts.map(plan => plan.fingerprint)).size,
        attempts: attempts.map(plan => ({
            attempt: plan.attempt,
            fingerprint: plan.fingerprint,
            score: plan.score
        }))
    };

    window.lastAutoShiftSearchSummary = summary;
    document.body.dataset.autoSearchSummary = JSON.stringify(summary);

    return bestPlan;

}

function buildAutoShiftPlan(context) {

    placeNightShifts(context);
    applyGlobalNextDayRules(context);
    adjustRestDays(context);
    placeDailyBaseShifts(context);
    fillRemainingWork(context);
    reduceBlankCells(context);
    rebalanceBlankCells(context);
    repairRestDayBounds(context);
    reduceBlankCells(context);
    polishAutoShift(context);

}

function captureShiftPlan(context) {

    return {
        attempt: context.attempt,
        score: scoreAutoShiftPlan(context),
        fingerprint: createShiftPlanFingerprint(context),
        rows: context.staffStates.map(state => ({
            staffId: state.staff.id,
            shifts: [...state.shifts]
        }))
    };

}

function applyShiftPlan(context, plan) {

    if (!plan) return;

    context.staffStates.forEach(state => {
        const row = plan.rows.find(item => Number(item.staffId) === Number(state.staff.id));
        if (!row) return;

        row.shifts.forEach((shift, day) => {
            if (!state.fixed[day]) {
                state.shifts[day] = shift || "";
            }
        });

        refreshAutoCounts(state, context);
    });

}

function comparePlanScore(a, b) {

    if (a.violations !== b.violations) return a.violations - b.violations;
    if (a.blanks !== b.blanks) return a.blanks - b.blanks;
    const aWorkOverflow = Math.max(0, a.workRange - 1);
    const bWorkOverflow = Math.max(0, b.workRange - 1);
    if (aWorkOverflow !== bWorkOverflow) return aWorkOverflow - bWorkOverflow;
    if (a.categoryTargetPenalty !== b.categoryTargetPenalty) return a.categoryTargetPenalty - b.categoryTargetPenalty;
    if (a.categoryRangePenalty !== b.categoryRangePenalty) return a.categoryRangePenalty - b.categoryRangePenalty;
    const aEarly1Overflow = Math.max(0, a.early1Range - 1);
    const bEarly1Overflow = Math.max(0, b.early1Range - 1);
    if (aEarly1Overflow !== bEarly1Overflow) return aEarly1Overflow - bEarly1Overflow;
    const aEarly2Overflow = Math.max(0, a.early2Range - 1);
    const bEarly2Overflow = Math.max(0, b.early2Range - 1);
    if (aEarly2Overflow !== bEarly2Overflow) return aEarly2Overflow - bEarly2Overflow;
    if (a.missingDoubleRest !== b.missingDoubleRest) return a.missingDoubleRest - b.missingDoubleRest;
    const aWeekendOverflow = Math.max(0, a.weekendRange - 1);
    const bWeekendOverflow = Math.max(0, b.weekendRange - 1);
    if (aWeekendOverflow !== bWeekendOverflow) return aWeekendOverflow - bWeekendOverflow;
    if (a.lateStandardPenalty !== b.lateStandardPenalty) return a.lateStandardPenalty - b.lateStandardPenalty;
    if (a.restPatternPenalty !== b.restPatternPenalty) return a.restPatternPenalty - b.restPatternPenalty;
    if (a.workStreakPenalty !== b.workStreakPenalty) return a.workStreakPenalty - b.workStreakPenalty;
    if (a.night1RunPenalty !== b.night1RunPenalty) return a.night1RunPenalty - b.night1RunPenalty;
    if (a.transitionPenalty !== b.transitionPenalty) return a.transitionPenalty - b.transitionPenalty;
    if (a.workRange !== b.workRange) return a.workRange - b.workRange;
    if (a.categoryMaxRange !== b.categoryMaxRange) return a.categoryMaxRange - b.categoryMaxRange;
    if (a.early1Range !== b.early1Range) return a.early1Range - b.early1Range;
    if (a.early2Range !== b.early2Range) return a.early2Range - b.early2Range;
    if (a.weekendRange !== b.weekendRange) return a.weekendRange - b.weekendRange;
    if (a.nightRange !== b.nightRange) return a.nightRange - b.nightRange;
    return a.lateRange - b.lateRange;

}

function clearAutoAssignedCells() {

    document.querySelectorAll("#shiftBody td[data-shift]").forEach(cell => {
        if (!isAutoAssignedCell(cell)) return;

        cell.dataset.shift = "";
        cell.textContent = "";
        delete cell.dataset.source;
        delete cell.dataset.autoAssigned;
        cell.classList.remove("autoAssignedCell", "autoWarningCell");
    });

    updateCount();
    clearAutoWarnings();

}

function clearAutoShiftResult() {

    const ok = confirm("自動作成したシフトをクリアします。\n手入力した勤務・希望休は残ります。\nよろしいですか？");
    if (!ok) return;

    clearAutoAssignedCells();
    updateCount();
    clearAutoWarnings();
    saveData();

}

function resetCurrentMonthShift() {

    const ok = confirm("この月のシフトをすべて削除します。\n手入力した勤務・希望休も削除されます。\nこの操作は元に戻せません。\nよろしいですか？");
    if (!ok) return;

    document.querySelectorAll("#shiftBody td[data-shift]").forEach(cell => {
        cell.dataset.shift = "";
        cell.textContent = "";
        delete cell.dataset.source;
        delete cell.dataset.autoAssigned;
        cell.classList.remove("autoAssignedCell", "autoWarningCell");
    });

    updateCount();
    clearAutoWarnings();
    saveData();

}

function isAutoAssignedCell(cell) {

    return cell.dataset.source === "auto" || cell.dataset.autoAssigned === "true";

}

function createAutoShiftContext(attempt = 0) {

    const [year, month] = monthSelect.value.split("-").map(Number);
    const days = new Date(year, month, 0).getDate();
    const previousMonth = getPreviousMonthValue(year, month);
    const previousData = typeof loadMonthShiftData === "function"
        ? loadMonthShiftData(previousMonth)
        : null;

    const rows = [...document.querySelectorAll("#shiftBody tr")];

    const staffStates = rows
        .map(row => {
            const staffId = Number(row.dataset.id);
            const staff = staffList.find(item => item.id === staffId);
            const cells = [...row.querySelectorAll("td[data-shift]")];
            const shifts = cells.map(cell => cell.dataset.shift || "");
            const fixed = cells.map(cell => {
                return (cell.dataset.shift || "") !== "" && !isAutoAssignedCell(cell);
            });
            const previousShifts = getPreviousShifts(previousData, staffId);
            const previousRestCount = previousShifts.filter(isRestShift).length;

            return {
                staff,
                row,
                cells,
                shifts,
                fixed,
                previousShifts,
                previousConsecutiveWork: countTrailingWorkDays(previousShifts),
                previousLastShift: previousShifts.length ? previousShifts[previousShifts.length - 1] : "",
                previousRestCount,
                targetRestDays: previousRestCount === AUTO_SHIFT_CONFIG.minRestDays
                    ? AUTO_SHIFT_CONFIG.maxRestDays
                    : AUTO_SHIFT_CONFIG.minRestDays,
                counts: getEmptyCounts()
            };
        })
        .filter(state => isAutoTargetStaff(state.staff));

    staffStates.forEach(state => {
        state.shifts.forEach(shift => addShiftToCounts(state.counts, shift));
    });

    const context = { year, month, days, staffStates, attempt };
    staffStates.forEach(state => {
        state.context = context;
        refreshAutoCounts(state, context);
    });

    return context;

}

function isAutoTargetStaff(staff) {

    if (!staff || !staff.enabled) return false;
    if (staff.autoAssign === false) return false;
    if (staff.name && staff.name.includes("副社長")) return false;
    return true;

}

function placeNightShifts(context) {

    getDayOrder(context, 1).forEach(day => {

        const date = new Date(context.year, context.month - 1, day + 1);
        if (date.getDay() === 3) {
            placeNight2Set(context, day);
            return;
        }

        placeNight1Set(context, day);

    });

}

function placeNight2Set(context, day) {

    if (hasShiftOnDay(context, day, "夜②")) return null;

    const candidates = getStateOrder(context, context.staffStates, day)
        .filter(state => canAssignShift(context, state, day, "夜②"))
        .filter(state => day + 1 >= context.days || canAssignShift(context, state, day + 1, "休"))
        .filter(state => {
            if (day + 1 >= context.days) return true;
            return findNextDayEarly2Partner(context, day, state) !== null;
        })
        .sort((a, b) => scoreSetCandidate(context, a, day, "夜②") - scoreSetCandidate(context, b, day, "夜②"));

    for (const state of candidates) {
        const partner = day + 1 < context.days ? findNextDayEarly2Partner(context, day, state) : null;

        if (!assignShift(state, day, "夜②", true)) continue;

        if (day + 1 < context.days && !assignShift(state, day + 1, "休", true)) {
            replaceAutoShift(state, day, "");
            continue;
        }

        if (partner && !hasShiftOnDay(context, day + 1, "早②")) {
            if (!assignShift(partner, day + 1, "早②", true)) {
                replaceAutoShift(state, day, "");
                replaceAutoShift(state, day + 1, "");
                continue;
            }
        }

        return state;
    }

    return null;

}

function placeNight1Set(context, day) {

    if (hasShiftOnDay(context, day, "夜①")) return null;

    const candidates = getStateOrder(context, context.staffStates, day)
        .filter(state => canAssignShift(context, state, day, "夜①"))
        .filter(state => day + 1 >= context.days || hasShiftByOtherStaff(context, day + 1, "早①", state) || findNextDayEarly1Partner(context, day, state) !== null)
        .sort((a, b) => scoreSetCandidate(context, a, day, "夜①") - scoreSetCandidate(context, b, day, "夜①"));

    for (const state of candidates) {
        const needsEarly = day + 1 < context.days && !hasShiftByOtherStaff(context, day + 1, "早①", state);
        const partner = needsEarly ? findNextDayEarly1Partner(context, day, state) : null;

        if (needsEarly && !partner) continue;
        if (!assignShift(state, day, "夜①", true)) continue;

        if (partner && !assignShift(partner, day + 1, "早①", true)) {
            replaceAutoShift(state, day, "");
            continue;
        }

        return state;
    }

    return null;

}

function findNextDayEarly1Partner(context, day, nightState) {

    if (day + 1 >= context.days) return null;

    return getStateOrder(context, context.staffStates, day + 1)
        .filter(state => state !== nightState)
        .filter(state => canAssignShift(context, state, day + 1, "早①"))
        .sort((a, b) => scoreSetCandidate(context, a, day + 1, "早①") - scoreSetCandidate(context, b, day + 1, "早①"))[0] || null;

}

function findNextDayEarly2Partner(context, day, nightState) {

    if (day + 1 >= context.days) return null;
    if (hasShiftByOtherStaff(context, day + 1, "早②", nightState)) return null;

    return getStateOrder(context, context.staffStates, day + 1)
        .filter(state => state !== nightState)
        .filter(state => canAssignShift(context, state, day + 1, "早②"))
        .sort((a, b) => scoreSetCandidate(context, a, day + 1, "早②") - scoreSetCandidate(context, b, day + 1, "早②"))[0] || null;

}

function applyGlobalNextDayRules(context) {

    for (let day = 0; day < context.days - 1; day++) {

        const night1Staff = context.staffStates.find(state => state.shifts[day] === "夜①");
        if (night1Staff && !hasShiftOnDay(context, day + 1, "早①")) {
            placeShift(context, day + 1, "早①", night1Staff);
        }

        const date = new Date(context.year, context.month - 1, day + 1);
        const night2Staff = context.staffStates.find(state => state.shifts[day] === "夜②");
        if (date.getDay() === 3 && night2Staff && !hasShiftOnDay(context, day + 1, "早②")) {
            placeShift(context, day + 1, "早②", night2Staff);
        }

    }

}

function placeDailyBaseShifts(context) {

    getDayOrder(context, 2).forEach(day => {

        getBaseShiftOrder(context).forEach(shift => {
            if (!hasShiftOnDay(context, day, shift)) {
                placeShift(context, day, shift);
            }
        });

        const date = new Date(context.year, context.month - 1, day + 1);
        if (date.getDay() !== 3 && !hasShiftOnDay(context, day, "早②")) {
            placeShift(context, day, "早②");
        }

    });

}

function adjustRestDays(context) {

    context.staffStates.forEach(state => {

        let guard = 0;
        while (countRestDays(state) < state.targetRestDays && guard < context.days * 2) {
            guard++;

            const day = chooseRestDay(context, state);
            if (day === -1) break;

            assignShift(state, day, "休", true);
        }

        for (let day = 0; day < context.days; day++) {
            if (getConsecutiveWorkDays(state, day) > AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays) {
                const restDay = findBlankDayInRange(state, Math.max(0, day - 2), day);
                if (restDay !== -1) {
                    assignShift(state, restDay, "休", true);
                }
            }
        }

    });

}

function fillRemainingWork(context) {

    const preferredShifts = getFillShiftOrder(context);

    getDayOrder(context, 3).forEach(day => {

        getStateOrder(context, context.staffStates, day).forEach(state => {

            if (state.shifts[day] !== "") return;
            if (countRestDays(state) < state.targetRestDays) return;

            const shift = preferredShifts
                .slice()
                .sort((a, b) => getShiftCount(state, a) - getShiftCount(state, b))
                .find(candidate => canAssignShift(context, state, day, candidate));

            if (shift) {
                assignShift(state, day, shift, true);
            }

        });

    });

}

function reduceBlankCells(context) {

    for (let pass = 0; pass < 3; pass++) {

        let changed = false;

        context.staffStates.forEach(state => {

            for (let day = 0; day < context.days; day++) {

                if (state.shifts[day] !== "") continue;

                if (countRestDays(state) < AUTO_SHIFT_CONFIG.minRestDays && canAssignShift(context, state, day, "休")) {
                    changed = assignShift(state, day, "休", true) || changed;
                    continue;
                }

                const directShift = chooseBlankFillShift(context, state, day);
                if (directShift) {
                    changed = assignShift(state, day, directShift, true) || changed;
                    continue;
                }

                if (countRestDays(state) < AUTO_SHIFT_CONFIG.maxRestDays && canAssignShift(context, state, day, "休")) {
                    changed = assignShift(state, day, "休", true) || changed;
                    continue;
                }

                if (moveSameDayAutoWorkToBlank(context, state, day)) {
                    changed = true;
                }

            }

        });

        if (!changed) break;

    }

}

function rebalanceBlankCells(context) {

    for (let pass = 0; pass < 4; pass++) {
        let changed = false;

        const blanks = getBlankTargets(context);
        for (const blank of blanks) {
            if (fillBlankByMovingAutoRest(context, blank.state, blank.day)) {
                changed = true;
                continue;
            }

            if (fillBlankByMovingAutoWork(context, blank.state, blank.day)) {
                changed = true;
            }
        }

        if (!changed) break;
    }

}

function repairRestDayBounds(context) {

    context.staffStates.forEach(state => {
        let guard = 0;

        while (countRestDays(state) < AUTO_SHIFT_CONFIG.minRestDays && guard < context.days) {
            guard++;

            const blankDay = state.shifts.findIndex((shift, day) => {
                return shift === "" && canAssignShift(context, state, day, "休");
            });

            if (blankDay !== -1) {
                assignShift(state, blankDay, "休", true);
                continue;
            }

            const workDay = findAutoWorkDayForRest(context, state);
            if (workDay === -1) break;

            replaceAutoShift(state, workDay, "休");
        }
    });

}

function polishAutoShift(context) {

    for (let pass = 0; pass < 8; pass++) {
        let changed = false;

        if (fillBlanksByPreviousNightSwap(context)) {
            changed = true;
        }

        if (improveDoubleRestWithoutWorseningBalance(context)) {
            changed = true;
        }

        if (improveSameDayShiftBalance(context)) {
            changed = true;
        }

        if (!changed) break;
    }

    localRegenerateTroubleWindows(context);
    improveCategoryTargets(context);
    improveWeekendBalanceByPairedExchange(context);
    improveFinalDoubleRest(context);
    improveNight1LongRuns(context);

}

function improveFinalDoubleRest(context) {

    for (let pass = 0; pass < 4; pass++) {
        const before = scoreAutoShiftPlan(context);
        if (before.missingDoubleRest === 0) break;

        const candidate = findFinalDoubleRestAdjustment(context);
        if (!candidate) break;

        const snapshot = captureContextSnapshot(context);
        applyFinalDoubleRestAdjustment(candidate);

        const after = scoreAutoShiftPlan(context);
        if (!isFinalDoubleRestBetter(before, after)) {
            restoreContextSnapshot(context, snapshot);
            break;
        }
    }

    if (scoreAutoShiftPlan(context).missingDoubleRest > 0) {
        improveDoubleRestByLocalRegeneration(context);
    }

}

function improveNight1LongRuns(context) {

    for (let pass = 0; pass < 3; pass++) {
        const before = scoreAutoShiftPlan(context);
        const candidate = findNight1LongRunRestSwap(context);

        if (!candidate) break;

        const snapshot = captureContextSnapshot(context);
        applyNight1LongRunRestSwap(candidate);

        const after = scoreAutoShiftPlan(context);
        if (!isNight1LongRunSwapBetter(before, after)) {
            restoreContextSnapshot(context, snapshot);
            break;
        }
    }

}

function findNight1LongRunRestSwap(context) {

    let best = null;

    context.staffStates.forEach(state => {
        getNight1LongRuns(state).forEach(run => {
            run.days.forEach(nightDay => {
                getNearbyAutoRestDays(state, run.start, run.end).forEach(restDay => {
                    const candidate = testNight1LongRunRestSwap(context, state, nightDay, restDay);
                    if (!candidate) return;

                    if (!best || comparePlanScore(candidate.score, best.score) < 0) {
                        best = candidate;
                    }
                });
            });
        });
    });

    return best;

}

function getNight1LongRuns(state) {

    const runs = [];
    const night1Shift = SHIFT_MASTER[4];

    for (let day = 0; day < state.shifts.length; day++) {
        if (state.shifts[day] !== night1Shift) continue;

        const start = day;
        let end = day;
        while (end + 1 < state.shifts.length && state.shifts[end + 1] === night1Shift) {
            end++;
        }

        if (end - start + 1 >= 4) {
            const days = [];
            for (let runDay = start; runDay <= end; runDay++) {
                days.push(runDay);
            }
            runs.push({ start, end, days });
        }

        day = end;
    }

    return runs;

}

function getNearbyAutoRestDays(state, start, end) {

    const restShift = SHIFT_MASTER[6];
    const from = Math.max(0, start - 7);
    const to = Math.min(state.shifts.length - 1, end + 7);
    const days = [];

    for (let day = from; day <= to; day++) {
        if (day >= start && day <= end) continue;
        if (state.fixed[day]) continue;
        if (!isAutoAssignedCell(state.cells[day])) continue;
        if (state.shifts[day] !== restShift) continue;
        days.push(day);
    }

    return days.sort((a, b) => Math.min(Math.abs(a - start), Math.abs(a - end)) - Math.min(Math.abs(b - start), Math.abs(b - end)));

}

function testNight1LongRunRestSwap(context, state, nightDay, restDay) {

    if (state.fixed[nightDay] || state.fixed[restDay]) return null;
    if (!isAutoAssignedCell(state.cells[nightDay]) || !isAutoAssignedCell(state.cells[restDay])) return null;

    const before = scoreAutoShiftPlan(context);
    const snapshot = captureContextSnapshot(context);

    applyNight1LongRunRestSwap({ state, nightDay, restDay });

    const after = scoreAutoShiftPlan(context);
    const result = isNight1LongRunSwapBetter(before, after)
        ? { state, nightDay, restDay, score: after }
        : null;

    restoreContextSnapshot(context, snapshot);
    return result;

}

function applyNight1LongRunRestSwap(candidate) {

    setAutoShiftValue(candidate.state, candidate.restDay, SHIFT_MASTER[4]);
    setAutoShiftValue(candidate.state, candidate.nightDay, SHIFT_MASTER[6]);

}

function isNight1LongRunSwapBetter(before, after) {

    if (after.violations !== 0) return false;
    if (after.violations > before.violations) return false;
    if (after.blanks > before.blanks) return false;
    if (after.workRange > before.workRange) return false;
    if (after.categoryTargetPenalty > before.categoryTargetPenalty) return false;
    if (after.categoryRangePenalty > before.categoryRangePenalty) return false;
    if (after.lateStandardPenalty > before.lateStandardPenalty) return false;
    if (after.missingDoubleRest > before.missingDoubleRest) return false;
    if (after.weekendRange > before.weekendRange) return false;
    if (after.night1RunPenalty >= before.night1RunPenalty) return false;

    return comparePlanScore(after, before) < 0;

}

function findFinalDoubleRestAdjustment(context) {

    let best = null;

    context.staffStates
        .filter(state => !hasConsecutiveRest(state))
        .forEach(state => {
            getRestDays(state).forEach(restDay => {
                [restDay - 1, restDay + 1].forEach(targetDay => {
                    const candidate = findDoubleRestSwapForDay(context, state, restDay, targetDay);
                    if (!candidate) return;

                    if (!best || comparePlanScore(candidate.score, best.score) < 0) {
                        best = candidate;
                    }
                });
            });
        });

    return best;

}

function findDoubleRestSwapForDay(context, state, restDay, targetDay) {

    if (targetDay < 0 || targetDay >= context.days) return null;
    if (!isWorkShift(state.shifts[targetDay])) return null;
    if (state.fixed[targetDay] || !isAutoAssignedCell(state.cells[targetDay])) return null;

    let best = null;

    context.staffStates.forEach(partner => {
        if (partner === state) return;
        if (partner.fixed[targetDay] || !isAutoAssignedCell(partner.cells[targetDay])) return;
        if (!isRestShift(partner.shifts[targetDay])) return;

        const direct = testFinalDoubleRestAdjustment(context, {
            state,
            partner,
            restDay,
            targetDay,
            targetShift: state.shifts[targetDay],
            giveBackDay: null,
            giveBackShift: ""
        });

        if (direct && (!best || comparePlanScore(direct.score, best.score) < 0)) {
            best = direct;
        }

        getRestDays(state).forEach(giveBackDay => {
            if (giveBackDay === restDay || giveBackDay === targetDay) return;
            if (state.fixed[giveBackDay] || partner.fixed[giveBackDay]) return;
            if (!isAutoAssignedCell(state.cells[giveBackDay]) || !isAutoAssignedCell(partner.cells[giveBackDay])) return;
            if (!isRestShift(state.shifts[giveBackDay]) || !isWorkShift(partner.shifts[giveBackDay])) return;

            const paired = testFinalDoubleRestAdjustment(context, {
                state,
                partner,
                restDay,
                targetDay,
                targetShift: state.shifts[targetDay],
                giveBackDay,
                giveBackShift: partner.shifts[giveBackDay]
            });

            if (paired && (!best || comparePlanScore(paired.score, best.score) < 0)) {
                best = paired;
            }
        });
    });

    return best;

}

function testFinalDoubleRestAdjustment(context, candidate) {

    if (!canReplaceShiftWith(context, candidate.state, candidate.targetDay, "休")) return null;
    if (!canReplaceShiftWith(context, candidate.partner, candidate.targetDay, candidate.targetShift)) return null;

    if (candidate.giveBackDay !== null) {
        if (!canReplaceShiftWith(context, candidate.state, candidate.giveBackDay, candidate.giveBackShift)) return null;
        if (!canReplaceShiftWith(context, candidate.partner, candidate.giveBackDay, "休")) return null;
    }

    const before = scoreAutoShiftPlan(context);
    const snapshot = captureContextSnapshot(context);

    applyFinalDoubleRestAdjustment(candidate);

    const after = scoreAutoShiftPlan(context);
    const result = isFinalDoubleRestBetter(before, after)
        ? { ...candidate, score: after }
        : null;

    restoreContextSnapshot(context, snapshot);
    return result;

}

function applyFinalDoubleRestAdjustment(candidate) {

    setAutoShiftValue(candidate.state, candidate.targetDay, "休");
    setAutoShiftValue(candidate.partner, candidate.targetDay, candidate.targetShift);

    if (candidate.giveBackDay !== null) {
        setAutoShiftValue(candidate.state, candidate.giveBackDay, candidate.giveBackShift);
        setAutoShiftValue(candidate.partner, candidate.giveBackDay, "休");
    }

}

function improveDoubleRestByLocalRegeneration(context) {

    const windows = collectDoubleRestWindows(context);

    for (const windowRange of windows) {
        const before = scoreAutoShiftPlan(context);
        if (before.missingDoubleRest === 0) break;

        const snapshot = captureContextSnapshot(context);

        clearAutoCellsInWindow(context, windowRange.start, windowRange.end);
        rebuildLocalWindow(context, windowRange.start, windowRange.end, windowRange.variant);
        polishLocalWindow(context, windowRange.start, windowRange.end);
        improveCategoryTargets(context);

        const after = scoreAutoShiftPlan(context);
        if (!isFinalDoubleRestBetter(before, after)) {
            restoreContextSnapshot(context, snapshot);
        }
    }

}

function collectDoubleRestWindows(context) {

    const windows = [];

    context.staffStates
        .filter(state => !hasConsecutiveRest(state))
        .forEach(state => {
            getRestDays(state).forEach(restDay => {
                [2, 3].forEach(radius => {
                    for (let variant = 0; variant < 3; variant++) {
                        windows.push({
                            start: Math.max(0, restDay - radius),
                            end: Math.min(context.days - 1, restDay + radius),
                            variant
                        });
                    }
                });
            });
        });

    return windows.slice(0, 36);

}

function isFinalDoubleRestBetter(before, after) {

    if (after.violations !== 0) return false;
    if (after.violations > before.violations) return false;
    if (after.blanks > before.blanks) return false;
    if (after.workRange > before.workRange) return false;
    if (after.categoryTargetPenalty > before.categoryTargetPenalty) return false;
    if (after.categoryRangePenalty > before.categoryRangePenalty) return false;
    if (after.lateStandardPenalty > before.lateStandardPenalty) return false;
    if (after.weekendRange > before.weekendRange) return false;
    return after.missingDoubleRest < before.missingDoubleRest;

}

function improveCategoryTargets(context) {

    for (let pass = 0; pass < 8; pass++) {
        const before = scoreAutoShiftPlan(context);
        if (before.categoryTargetPenalty === 0 && before.lateStandardPenalty === 0) break;

        const candidate = findCategoryTargetReplacement(context);
        if (!candidate) break;

        const snapshot = captureContextSnapshot(context);
        replaceAutoShift(candidate.state, candidate.day, candidate.newShift);

        const after = scoreAutoShiftPlan(context);
        if (!isCategoryReplacementBetter(before, after)) {
            restoreContextSnapshot(context, snapshot);
            break;
        }
    }

}

function findCategoryTargetReplacement(context) {

    let best = null;

    context.staffStates.forEach(state => {
        getUnderTargetShiftOptions(state).forEach(newShift => {
            state.shifts.forEach((oldShift, day) => {
                const candidate = testCategoryTargetReplacement(context, state, day, oldShift, newShift);
                if (!candidate) return;

                if (!best || comparePlanScore(candidate.score, best.score) < 0) {
                    best = candidate;
                }
            });
        });
    });

    return best;

}

function testCategoryTargetReplacement(context, state, day, oldShift, newShift) {

    if (!isWorkShift(oldShift)) return null;
    if (oldShift === newShift) return null;
    if (!isAutoAssignedCell(state.cells[day])) return null;
    if (!canReplaceShiftWith(context, state, day, newShift)) return null;
    if (!isUsefulCategoryReplacement(state, oldShift, newShift)) return null;

    const before = scoreAutoShiftPlan(context);
    const snapshot = captureContextSnapshot(context);

    replaceAutoShift(state, day, newShift);
    const after = scoreAutoShiftPlan(context);
    const result = isCategoryReplacementBetter(before, after)
        ? { state, day, oldShift, newShift, score: after }
        : null;

    restoreContextSnapshot(context, snapshot);
    return result;

}

function canReplaceShiftWith(context, state, day, newShift) {

    const oldShift = state.shifts[day];
    if (state.fixed[day]) return false;

    state.shifts[day] = "";
    const canAssign = canAssignShift(context, state, day, newShift);
    state.shifts[day] = oldShift;

    return canAssign;

}

function isUsefulCategoryReplacement(state, oldShift, newShift) {

    const before = getCategoryTargetDistance(getCategoryCounts(state));
    const beforeLateStandard = getLateStandardDistance(getCategoryCounts(state));
    const counts = getCategoryCounts(state);

    decrementCategoryCount(counts, oldShift);
    incrementCategoryCount(counts, newShift);

    const after = getCategoryTargetDistance(counts);
    const afterLateStandard = getLateStandardDistance(counts);

    if (after < before) return true;
    return after === before && afterLateStandard < beforeLateStandard;

}

function getUnderTargetShiftOptions(state) {

    const counts = getCategoryCounts(state);
    const options = [];

    if (counts.late < AUTO_SHIFT_CONFIG.targetLateCount) {
        options.push("遅");
    }

    if (counts.early < AUTO_SHIFT_CONFIG.minCategoryCount) {
        options.push(state.counts.early1 <= state.counts.early2 ? "早①" : "早②");
    }

    if (counts.night < AUTO_SHIFT_CONFIG.minCategoryCount) {
        options.push("夜①");
    }

    return options;

}

function incrementCategoryCount(counts, shift) {

    if (isEarlyShift(shift)) counts.early++;
    if (shift === "遅") counts.late++;
    if (isNightShift(shift)) counts.night++;
    if (isRestShift(shift)) counts.rest++;

}

function decrementCategoryCount(counts, shift) {

    if (isEarlyShift(shift)) counts.early--;
    if (shift === "遅") counts.late--;
    if (isNightShift(shift)) counts.night--;
    if (isRestShift(shift)) counts.rest--;

}

function isCategoryReplacementBetter(before, after) {

    if (after.violations !== 0) return false;
    if (after.violations > before.violations) return false;
    if (after.blanks > before.blanks) return false;
    if (after.workRange > before.workRange) return false;
    if (after.missingDoubleRest > before.missingDoubleRest) return false;
    if (after.weekendRange > before.weekendRange) return false;
    if (after.categoryRangePenalty > before.categoryRangePenalty) return false;
    if (after.categoryTargetPenalty < before.categoryTargetPenalty) return true;
    return after.categoryTargetPenalty === before.categoryTargetPenalty
        && after.lateStandardPenalty < before.lateStandardPenalty;

}

function improveWeekendBalanceByPairedExchange(context) {

    for (let pass = 0; pass < 4; pass++) {
        const before = scoreAutoShiftPlan(context);
        if (before.weekendRange < 2) break;

        const candidate = findWeekendPairedExchange(context);
        if (!candidate) break;

        const snapshot = captureContextSnapshot(context);
        applyWeekendPairedExchange(candidate);

        const after = scoreAutoShiftPlan(context);
        if (!isWeekendPairExchangeBetter(before, after)) {
            restoreContextSnapshot(context, snapshot);
            break;
        }
    }

}

function findWeekendPairedExchange(context) {

    const highStates = getStatesWithExtremeCount(context, "weekendWork", "high");
    const lowStates = getStatesWithExtremeCount(context, "weekendWork", "low");
    let best = null;

    highStates.forEach(highState => {
        lowStates.forEach(lowState => {
            if (highState === lowState) return;

            getWeekendWorkDays(context, highState).forEach(weekendDay => {
                getWeekdayWorkDays(context, lowState).forEach(weekdayDay => {
                    const candidate = testWeekendPairedExchange(context, highState, lowState, weekendDay, weekdayDay);
                    if (!candidate) return;

                    if (!best || comparePlanScore(candidate.score, best.score) < 0) {
                        best = candidate;
                    }
                });
            });
        });
    });

    return best;

}

function testWeekendPairedExchange(context, highState, lowState, weekendDay, weekdayDay) {

    if (!canSwapAutoCells(highState, lowState, weekendDay)) return null;
    if (!canSwapAutoCells(highState, lowState, weekdayDay)) return null;
    if (!isWeekend(context, weekendDay) || isWeekend(context, weekdayDay)) return null;
    if (!isWorkShift(highState.shifts[weekendDay])) return null;
    if (!isRestShift(lowState.shifts[weekendDay])) return null;
    if (!isRestShift(highState.shifts[weekdayDay])) return null;
    if (!isWorkShift(lowState.shifts[weekdayDay])) return null;

    const before = scoreAutoShiftPlan(context);
    const snapshot = captureContextSnapshot(context);

    const weekendShift = highState.shifts[weekendDay];
    const weekdayShift = lowState.shifts[weekdayDay];

    setAutoShiftValue(highState, weekendDay, "休");
    setAutoShiftValue(lowState, weekendDay, weekendShift);
    setAutoShiftValue(highState, weekdayDay, weekdayShift);
    setAutoShiftValue(lowState, weekdayDay, "休");

    const after = scoreAutoShiftPlan(context);
    const accepted = isWeekendPairExchangeBetter(before, after);
    const result = accepted
        ? { highState, lowState, weekendDay, weekdayDay, weekendShift, weekdayShift, score: after }
        : null;

    restoreContextSnapshot(context, snapshot);
    return result;

}

function applyWeekendPairedExchange(candidate) {

    setAutoShiftValue(candidate.highState, candidate.weekendDay, "休");
    setAutoShiftValue(candidate.lowState, candidate.weekendDay, candidate.weekendShift);
    setAutoShiftValue(candidate.highState, candidate.weekdayDay, candidate.weekdayShift);
    setAutoShiftValue(candidate.lowState, candidate.weekdayDay, "休");

}

function isWeekendPairExchangeBetter(before, after) {

    if (after.violations !== 0) return false;
    if (after.violations > before.violations) return false;
    if (after.blanks > before.blanks) return false;
    if (after.workRange > before.workRange) return false;
    if (after.categoryTargetPenalty > before.categoryTargetPenalty) return false;
    if (after.categoryRangePenalty > before.categoryRangePenalty) return false;
    if (after.lateStandardPenalty > before.lateStandardPenalty) return false;
    if (after.missingDoubleRest > before.missingDoubleRest) return false;
    if (after.nightRange > before.nightRange) return false;
    if (after.early1Range > before.early1Range) return false;
    if (after.early2Range > before.early2Range) return false;
    if (after.lateRange > before.lateRange) return false;
    return after.weekendRange < before.weekendRange;

}

function getWeekendWorkDays(context, state) {

    return state.shifts
        .map((shift, day) => ({ shift, day }))
        .filter(item => isWeekend(context, item.day))
        .filter(item => isWorkShift(item.shift))
        .map(item => item.day);

}

function getWeekdayWorkDays(context, state) {

    return state.shifts
        .map((shift, day) => ({ shift, day }))
        .filter(item => !isWeekend(context, item.day))
        .filter(item => isWorkShift(item.shift))
        .map(item => item.day);

}

function localRegenerateTroubleWindows(context) {

    const windows = collectTroubleWindows(context);

    for (const windowRange of windows) {
        const before = scoreAutoShiftPlan(context);
        const snapshot = captureContextSnapshot(context);

        clearAutoCellsInWindow(context, windowRange.start, windowRange.end);
        rebuildLocalWindow(context, windowRange.start, windowRange.end, windowRange.variant);
        polishLocalWindow(context, windowRange.start, windowRange.end);

        const after = scoreAutoShiftPlan(context);
        if (!isLocalRegenerationBetter(before, after)) {
            restoreContextSnapshot(context, snapshot);
        }
    }

}

function collectTroubleWindows(context) {

    const centers = new Set();

    context.staffStates.forEach(state => {
        state.shifts.forEach((shift, day) => {
            if (shift === "") centers.add(day);
        });

        collectNight1LongRunCenters(state).forEach(day => centers.add(day));

        if (!hasConsecutiveRest(state)) {
            state.shifts.forEach((shift, day) => {
                if (isRestShift(shift)) centers.add(day);
            });
        }
    });

    ["early2", "late", "weekendWork", "night", "early1"].forEach(key => {
        const high = getStatesWithExtremeCount(context, key, "high");
        const low = getStatesWithExtremeCount(context, key, "low");

        high.forEach(state => {
            state.shifts.forEach((shift, day) => {
                if (matchesBalanceKey(context, key, shift, day)) centers.add(day);
            });
        });

        low.forEach(state => {
            state.shifts.forEach((shift, day) => {
                if (shift === "" || isRestShift(shift)) centers.add(day);
            });
        });
    });

    const windows = [];
    [...centers].forEach(center => {
        [2, 3].forEach(radius => {
            for (let variant = 0; variant < 3; variant++) {
                windows.push({
                    start: Math.max(0, center - radius),
                    end: Math.min(context.days - 1, center + radius),
                    variant
                });
            }
        });
    });

    return windows.slice(0, 54);

}

function collectNight1LongRunCenters(state) {

    const centers = [];
    const night1Shift = SHIFT_MASTER[4];

    for (let day = 0; day < state.shifts.length; day++) {
        if (state.shifts[day] !== night1Shift) continue;

        let end = day;
        while (end + 1 < state.shifts.length && state.shifts[end + 1] === night1Shift) {
            end++;
        }

        if (end - day + 1 >= 4) {
            centers.push(Math.floor((day + end) / 2));
        }

        day = end;
    }

    return centers;

}

function getStatesWithExtremeCount(context, key, direction) {

    const values = context.staffStates.map(state => getBalanceValue(state, key));
    const target = direction === "high" ? Math.max(...values) : Math.min(...values);

    return context.staffStates.filter(state => getBalanceValue(state, key) === target);

}

function getBalanceValue(state, key) {

    if (key === "work") return countWorkDays(state);
    return state.counts[key];

}

function matchesBalanceKey(context, key, shift, day) {

    if (key === "night") return isNightShift(shift);
    if (key === "early1") return shift === "早①";
    if (key === "early2") return shift === "早②";
    if (key === "late") return shift === "遅";
    if (key === "weekendWork") return isWeekend(context, day) && isWorkShift(shift);
    return false;

}

function captureContextSnapshot(context) {

    return context.staffStates.map(state => ({
        state,
        shifts: [...state.shifts],
        sources: state.cells.map(cell => cell.dataset.source || ""),
        autoAssigned: state.cells.map(cell => cell.dataset.autoAssigned || "")
    }));

}

function restoreContextSnapshot(context, snapshot) {

    snapshot.forEach(item => {
        item.shifts.forEach((shift, day) => {
            const cell = item.state.cells[day];
            item.state.shifts[day] = shift;
            cell.dataset.shift = shift;
            cell.textContent = getShiftDisplayName(shift);

            if (item.sources[day]) {
                cell.dataset.source = item.sources[day];
            } else {
                delete cell.dataset.source;
            }

            if (item.autoAssigned[day]) {
                cell.dataset.autoAssigned = item.autoAssigned[day];
                cell.classList.add("autoAssignedCell");
            } else {
                delete cell.dataset.autoAssigned;
                cell.classList.remove("autoAssignedCell");
            }
        });

        refreshAutoCounts(item.state, context);
    });

}

function clearAutoCellsInWindow(context, start, end) {

    context.staffStates.forEach(state => {
        for (let day = start; day <= end; day++) {
            if (state.fixed[day]) continue;
            if (!isAutoAssignedCell(state.cells[day])) continue;
            setAutoShiftValue(state, day, "");
        }
    });

}

function rebuildLocalWindow(context, start, end, variant) {

    const originalAttempt = context.attempt;
    context.attempt = originalAttempt + variant + 1;

    getWindowDayOrder(context, start, end, 1).forEach(day => {
        const date = new Date(context.year, context.month - 1, day + 1);
        if (date.getDay() === 3) {
            placeNight2Set(context, day);
        } else {
            placeNight1Set(context, day);
        }
    });

    for (let day = Math.max(0, start - 1); day <= Math.min(context.days - 2, end); day++) {
        const night1Staff = context.staffStates.find(state => state.shifts[day] === "夜①");
        if (night1Staff && !hasShiftOnDay(context, day + 1, "早①")) {
            placeShift(context, day + 1, "早①", night1Staff);
        }

        const date = new Date(context.year, context.month - 1, day + 1);
        const night2Staff = context.staffStates.find(state => state.shifts[day] === "夜②");
        if (date.getDay() === 3 && night2Staff && !hasShiftOnDay(context, day + 1, "早②")) {
            placeShift(context, day + 1, "早②", night2Staff);
        }
    }

    getWindowDayOrder(context, start, end, 2).forEach(day => {
        getBaseShiftOrder(context).forEach(shift => {
            if (!hasShiftOnDay(context, day, shift)) {
                placeShift(context, day, shift);
            }
        });

        const date = new Date(context.year, context.month - 1, day + 1);
        if (date.getDay() !== 3 && !hasShiftOnDay(context, day, "早②")) {
            placeShift(context, day, "早②");
        }
    });

    getWindowDayOrder(context, start, end, 3).forEach(day => {
        getStateOrder(context, context.staffStates, day).forEach(state => {
            if (state.shifts[day] !== "") return;
            if (countRestDays(state) < AUTO_SHIFT_CONFIG.minRestDays && canAssignShift(context, state, day, "休")) {
                assignShift(state, day, "休", true);
                return;
            }

            const shift = getFillShiftOrder(context).find(candidate => canAssignShift(context, state, day, candidate));
            if (shift) {
                assignShift(state, day, shift, true);
            } else if (countRestDays(state) < AUTO_SHIFT_CONFIG.maxRestDays && canAssignShift(context, state, day, "休")) {
                assignShift(state, day, "休", true);
            }
        });
    });

    repairRestDayBounds(context);
    reduceBlankCells(context);
    context.attempt = originalAttempt;

}

function polishLocalWindow(context, start, end) {

    for (let pass = 0; pass < 3; pass++) {
        let changed = false;

        for (let day = start; day <= end; day++) {
            for (let left = 0; left < context.staffStates.length; left++) {
                for (let right = left + 1; right < context.staffStates.length; right++) {
                    if (trySwapSameDayShifts(context, context.staffStates[left], context.staffStates[right], day)) {
                        changed = true;
                    }
                }
            }
        }

        if (!changed) break;
    }

}

function getWindowDayOrder(context, start, end, phase) {

    return getDayOrder(context, phase).filter(day => day >= start && day <= end);

}

function isLocalRegenerationBetter(before, after) {

    if (after.violations !== 0) return false;
    if (after.violations > before.violations) return false;
    if (after.blanks > before.blanks) return false;
    if (after.workRange > before.workRange) return false;
    if (after.categoryTargetPenalty > before.categoryTargetPenalty) return false;
    if (after.categoryRangePenalty > before.categoryRangePenalty) return false;
    if (after.lateStandardPenalty > before.lateStandardPenalty) return false;
    if (after.missingDoubleRest > before.missingDoubleRest) return false;

    return comparePlanScore(after, before) < 0;

}

function improveSameDayShiftBalance(context) {

    let changed = false;

    for (let day = 0; day < context.days; day++) {
        for (let left = 0; left < context.staffStates.length; left++) {
            for (let right = left + 1; right < context.staffStates.length; right++) {
                const a = context.staffStates[left];
                const b = context.staffStates[right];

                if (!canSwapAutoCells(a, b, day)) continue;
                if (!isWorkShift(a.shifts[day]) || !isWorkShift(b.shifts[day])) continue;
                if (a.shifts[day] === b.shifts[day]) continue;

                if (trySwapSameDayShifts(context, a, b, day)) {
                    changed = true;
                }
            }
        }
    }

    return changed;

}

function trySwapSameDayShifts(context, a, b, day) {

    const before = scoreAutoShiftPlan(context);
    const aShift = a.shifts[day];
    const bShift = b.shifts[day];

    setAutoShiftValue(a, day, bShift);
    setAutoShiftValue(b, day, aShift);

    const after = scoreAutoShiftPlan(context);
    if (isPolishScoreBetter(before, after)) {
        return true;
    }

    setAutoShiftValue(a, day, aShift);
    setAutoShiftValue(b, day, bShift);
    return false;

}

function fillBlanksByPreviousNightSwap(context) {

    let changed = false;

    context.staffStates.forEach(blankState => {
        blankState.shifts.forEach((shift, day) => {
            if (shift !== "" || day === 0) return;
            if (!isNightShift(blankState.shifts[day - 1])) return;
            if (countRestDays(blankState) >= AUTO_SHIFT_CONFIG.maxRestDays) return;

            const donor = findPreviousDayWorkSwapDonor(context, blankState, day);
            if (!donor) return;

            const oldBlankPrev = blankState.shifts[day - 1];
            const oldDonorPrev = donor.shifts[day - 1];
            const before = scoreAutoShiftPlan(context);

            setAutoShiftValue(blankState, day - 1, oldDonorPrev);
            setAutoShiftValue(donor, day - 1, oldBlankPrev);

            if (canAssignShift(context, blankState, day, "休")) {
                assignShift(blankState, day, "休", true);
            }

            const after = scoreAutoShiftPlan(context);
            if (isPolishScoreBetter(before, after)) {
                changed = true;
                return;
            }

            setAutoShiftValue(blankState, day, "");
            setAutoShiftValue(blankState, day - 1, oldBlankPrev);
            setAutoShiftValue(donor, day - 1, oldDonorPrev);
        });
    });

    return changed;

}

function findPreviousDayWorkSwapDonor(context, blankState, blankDay) {

    const previousDay = blankDay - 1;

    return context.staffStates
        .filter(state => state !== blankState)
        .filter(state => canSwapAutoCells(blankState, state, previousDay))
        .filter(state => isWorkShift(state.shifts[previousDay]) && !isNightShift(state.shifts[previousDay]))
        .sort((a, b) => scoreCandidate(context, a, previousDay, blankState.shifts[previousDay]) - scoreCandidate(context, b, previousDay, blankState.shifts[previousDay]))[0] || null;

}

function improveDoubleRestWithoutWorseningBalance(context) {

    let changed = false;

    context.staffStates.forEach(state => {
        if (hasConsecutiveRest(state)) return;

        for (let day = 0; day < context.days - 1; day++) {
            if (!isRestShift(state.shifts[day])) continue;

            const nextShift = state.shifts[day + 1];
            if (!isWorkShift(nextShift)) continue;
            if (state.fixed[day + 1] || !isAutoAssignedCell(state.cells[day + 1])) continue;

            const partner = context.staffStates.find(other => {
                return other !== state
                    && !other.fixed[day + 1]
                    && isAutoAssignedCell(other.cells[day + 1])
                    && isRestShift(other.shifts[day + 1]);
            });

            if (!partner) continue;

            const before = scoreAutoShiftPlan(context);
            setAutoShiftValue(state, day + 1, "休");
            setAutoShiftValue(partner, day + 1, nextShift);

            const after = scoreAutoShiftPlan(context);
            if (isPolishScoreBetter(before, after)) {
                changed = true;
                return;
            }

            setAutoShiftValue(state, day + 1, nextShift);
            setAutoShiftValue(partner, day + 1, "休");
        }
    });

    return changed;

}

function canSwapAutoCells(a, b, day) {

    return !a.fixed[day]
        && !b.fixed[day]
        && isAutoAssignedCell(a.cells[day])
        && isAutoAssignedCell(b.cells[day]);

}

function isPolishScoreBetter(before, after) {

    if (after.violations !== 0) return false;
    if (after.violations > before.violations) return false;
    if (after.blanks > before.blanks) return false;
    if (after.workRange > before.workRange) return false;
    if (after.categoryTargetPenalty > before.categoryTargetPenalty) return false;
    if (after.categoryRangePenalty > before.categoryRangePenalty) return false;
    if (after.lateStandardPenalty > before.lateStandardPenalty) return false;
    if (after.missingDoubleRest > before.missingDoubleRest) return false;

    return comparePlanScore(after, before) < 0;

}

function setAutoShiftValue(state, day, shift) {

    if (state.fixed[day]) return false;

    state.shifts[day] = shift;
    const cell = state.cells[day];
    cell.dataset.shift = shift;
    cell.textContent = getShiftDisplayName(shift);

    if (shift) {
        cell.dataset.source = "auto";
        cell.dataset.autoAssigned = "true";
        cell.classList.add("autoAssignedCell");
    } else {
        delete cell.dataset.source;
        delete cell.dataset.autoAssigned;
        cell.classList.remove("autoAssignedCell");
    }

    refreshAutoCounts(state, state.context);
    return true;

}

function findAutoWorkDayForRest(context, state) {

    for (let day = context.days - 1; day >= 0; day--) {
        if (state.fixed[day]) continue;
        if (!isAutoAssignedCell(state.cells[day])) continue;
        if (!isWorkShift(state.shifts[day])) continue;
        if (!canRemoveAutoShift(context, state, day)) continue;
        return day;
    }

    return -1;

}

function getBlankTargets(context) {

    const blanks = [];

    context.staffStates.forEach(state => {
        state.shifts.forEach((shift, day) => {
            if (shift === "") {
                blanks.push({ state, day });
            }
        });
    });

    return blanks.sort((a, b) => {
        const aOptions = countFillOptions(context, a.state, a.day);
        const bOptions = countFillOptions(context, b.state, b.day);
        return aOptions - bOptions;
    });

}

function countFillOptions(context, state, day) {

    return ["早①", "早②", "遅", "夜①", "休"]
        .filter(shift => {
            if (shift === "休" && countRestDays(state) >= AUTO_SHIFT_CONFIG.maxRestDays) return false;
            if (shift === "夜①" && !canUseNight1ForBlank(context, state, day)) return false;
            return canAssignShift(context, state, day, shift);
        }).length;

}

function fillBlankByMovingAutoRest(context, state, blankDay) {

    if (countRestDays(state) < AUTO_SHIFT_CONFIG.maxRestDays) return false;
    if (!canAssignShift(context, state, blankDay, "休")) return false;

    const restDays = getMovableAutoRestDays(context, state, blankDay);

    for (const restDay of restDays) {
        for (const shift of getRestReplacementShifts(context, state, restDay)) {
            if (moveAutoRestToBlank(context, state, blankDay, restDay, shift)) {
                return true;
            }
        }
    }

    return false;

}

function getMovableAutoRestDays(context, state, blankDay) {

    const days = [];

    for (let day = 0; day < context.days; day++) {
        if (day === blankDay) continue;
        if (state.fixed[day]) continue;
        if (state.shifts[day] !== "休") continue;
        if (!isAutoAssignedCell(state.cells[day])) continue;
        days.push(day);
    }

    return days.sort((a, b) => {
        return Math.abs(b - blankDay) - Math.abs(a - blankDay);
    });

}

function getRestReplacementShifts(context, state, day) {

    const shifts = ["早①", "早②", "遅"];

    if (canUseNight1ForBlank(context, state, day)) {
        shifts.push("夜①");
    }

    return shifts.sort((a, b) => getShiftCount(state, a) - getShiftCount(state, b));

}

function moveAutoRestToBlank(context, state, blankDay, restDay, replacementShift) {

    replaceAutoShift(state, restDay, "");

    if (!canAssignShift(context, state, restDay, replacementShift)) {
        replaceAutoShift(state, restDay, "休");
        return false;
    }

    if (!assignShift(state, blankDay, "休", true)) {
        replaceAutoShift(state, restDay, "休");
        return false;
    }

    if (assignShift(state, restDay, replacementShift, true)) {
        return true;
    }

    replaceAutoShift(state, blankDay, "");
    replaceAutoShift(state, restDay, "休");
    return false;

}

function fillBlankByMovingAutoWork(context, blankState, day) {

    if (countRestDays(blankState) < AUTO_SHIFT_CONFIG.minRestDays) return false;

    const donors = context.staffStates
        .filter(state => state !== blankState)
        .filter(state => !state.fixed[day])
        .filter(state => isAutoAssignedCell(state.cells[day]))
        .filter(state => isWorkShift(state.shifts[day]))
        .filter(state => canRemoveAutoShift(context, state, day))
        .sort((a, b) => scoreMoveDonor(a, day) - scoreMoveDonor(b, day));

    for (const donor of donors) {
        const shift = donor.shifts[day];
        if (!canAssignShift(context, blankState, day, shift)) continue;

        replaceAutoShift(donor, day, "休");
        if (assignShift(blankState, day, shift, true)) return true;
        replaceAutoShift(donor, day, shift);
    }

    return false;

}

function canRemoveAutoShift(context, state, day) {

    const shift = state.shifts[day];
    if (shift === "夜①" || shift === "夜②") return false;
    if (shift === "早①" && isRequiredEarlyAfterNight1(context, day, state)) return false;
    if (shift === "早②" && isRequiredEarly2AfterWednesdayNight2(context, day, state)) return false;
    if (countRestDays(state) >= AUTO_SHIFT_CONFIG.maxRestDays) return false;
    return true;

}

function isRequiredEarlyAfterNight1(context, day, state) {

    if (day <= 0) return false;
    const nightStaff = context.staffStates.find(item => item.shifts[day - 1] === "夜①");
    if (!nightStaff || nightStaff === state) return false;
    return !context.staffStates.some(item => item !== state && item !== nightStaff && item.shifts[day] === "早①");

}

function isRequiredEarly2AfterWednesdayNight2(context, day, state) {

    if (day <= 0) return false;
    const previousDate = new Date(context.year, context.month - 1, day);
    const nightStaff = context.staffStates.find(item => item.shifts[day - 1] === "夜②");
    if (previousDate.getDay() !== 3 || !nightStaff || nightStaff === state) return false;
    return !context.staffStates.some(item => item !== state && item !== nightStaff && item.shifts[day] === "早②");

}

function hasPersonalNightConnectionViolation(state) {

    for (let day = 0; day < state.shifts.length - 1; day++) {
        const shift = state.shifts[day];
        const nextShift = state.shifts[day + 1];

        if (isNightShift(shift) && (isEarlyShift(nextShift) || nextShift === "遅")) return true;
        if (shift === "夜②" && nextShift !== "休") return true;
    }

    return false;

}

function scoreMoveDonor(state, day) {

    return countRestDays(state) * 10 + getShiftCount(state, state.shifts[day]);

}

function chooseBlankFillShift(context, state, day) {

    if (countRestDays(state) < AUTO_SHIFT_CONFIG.minRestDays) return null;

    const shifts = ["早①", "早②", "遅"];

    if (canUseNight1ForBlank(context, state, day)) {
        shifts.push("夜①");
    }

    return shifts
        .slice()
        .sort((a, b) => getShiftCount(state, a) - getShiftCount(state, b))
        .find(shift => canAssignShift(context, state, day, shift)) || null;

}

function canUseNight1ForBlank(context, state, day) {

    if (day >= context.days - 1) return false;
    return hasShiftByOtherStaff(context, day + 1, "早①", state);

}

function moveSameDayAutoWorkToBlank(context, blankState, day) {

    if (countRestDays(blankState) < AUTO_SHIFT_CONFIG.minRestDays) return false;

    const donors = context.staffStates
        .filter(state => state !== blankState)
        .filter(state => state.shifts[day] === "遅")
        .filter(state => !state.fixed[day])
        .filter(state => isAutoAssignedCell(state.cells[day]))
        .filter(state => countRestDays(state) < AUTO_SHIFT_CONFIG.maxRestDays)
        .sort((a, b) => countRestDays(a) - countRestDays(b));

    for (const donor of donors) {
        if (!canAssignShift(context, blankState, day, donor.shifts[day])) continue;

        if (replaceAutoShift(donor, day, "休") && assignShift(blankState, day, "遅", true)) {
            return true;
        }
    }

    return false;

}

function placeShift(context, day, shift, excludedState = null) {

    const candidates = getStateOrder(context, context.staffStates, day)
        .filter(state => state !== excludedState)
        .filter(state => canAssignShift(context, state, day, shift))
        .sort((a, b) => scoreCandidate(context, a, day, shift) - scoreCandidate(context, b, day, shift));

    if (candidates.length === 0) return null;

    assignShift(candidates[0], day, shift, true);
    return candidates[0];

}

function getDayOrder(context, phase) {

    const days = Array.from({ length: context.days }, (_, index) => index);
    const offset = (context.attempt * (phase + 2) + phase) % context.days;
    const ordered = days.slice(offset).concat(days.slice(0, offset));

    if ((context.attempt + phase) % 3 === 1) {
        ordered.reverse();
    }

    return ordered;

}

function getStateOrder(context, states, day) {

    const indexed = states.map((state, index) => ({ state, index }));
    const offset = states.length === 0 ? 0 : (context.attempt + day) % states.length;

    return indexed
        .sort((a, b) => {
            const aOrder = (a.index - offset + states.length) % states.length;
            const bOrder = (b.index - offset + states.length) % states.length;

            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.state.staff.id - b.state.staff.id;
        })
        .map(item => item.state);

}

function getBaseShiftOrder(context) {

    return context.attempt % 2 === 0 ? ["早①", "遅"] : ["遅", "早①"];

}

function getFillShiftOrder(context) {

    const orders = [
        ["早①", "早②", "遅"],
        ["遅", "早①", "早②"],
        ["早②", "遅", "早①"]
    ];

    return orders[context.attempt % orders.length];

}

function canAssignShift(context, state, day, shift) {

    if (state.fixed[day]) return false;
    if (state.shifts[day] !== "") return false;
    if (day < 0 || day >= context.days) return false;

    const previousShift = getPreviousShift(state, day);
    const nextShift = state.shifts[day + 1] || "";

    if (previousShift === "夜②" && shift !== "休") return false;
    if (isNightShift(previousShift) && (isEarlyShift(shift) || shift === "遅")) return false;
    if (isNightShift(shift) && (isEarlyShift(nextShift) || nextShift === "遅")) return false;
    if (shift === "夜②" && nextShift && nextShift !== "休") return false;

    if (isWorkShift(shift)) {
        if (wouldExceedMaxConsecutiveWork(state, day, shift)) {
            return false;
        }
    }

    return true;

}

function wouldExceedMaxConsecutiveWork(state, day, shift) {

    const original = state.shifts[day];
    state.shifts[day] = shift;

    const start = Math.max(0, day - AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays);
    const end = Math.min(state.shifts.length - 1, day + AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays);
    let exceeds = false;

    for (let index = start; index <= end; index++) {
        if (getConsecutiveWorkDays(state, index) > AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays) {
            exceeds = true;
            break;
        }
    }

    state.shifts[day] = original;
    return exceeds;

}

function assignShift(state, day, shift, automatic) {

    if (state.fixed[day]) return false;
    if (state.shifts[day] !== "" && state.shifts[day] !== shift) return false;

    const oldShift = state.shifts[day];

    removeShiftFromCounts(state.counts, oldShift);
    if (state.context && isWeekend(state.context, day) && isWorkShift(oldShift)) {
        state.counts.weekendWork--;
    }

    state.shifts[day] = shift;

    addShiftToCounts(state.counts, shift);
    if (state.context && isWeekend(state.context, day) && isWorkShift(shift)) {
        state.counts.weekendWork++;
    }

    if (automatic) {
        state.cells[day].dataset.source = "auto";
        state.cells[day].dataset.autoAssigned = "true";
    }

    return true;

}

function replaceAutoShift(state, day, shift) {

    if (state.fixed[day]) return false;
    if (!isAutoAssignedCell(state.cells[day])) return false;

    const oldShift = state.shifts[day];

    removeShiftFromCounts(state.counts, oldShift);
    if (state.context && isWeekend(state.context, day) && isWorkShift(oldShift)) {
        state.counts.weekendWork--;
    }

    state.shifts[day] = shift;

    addShiftToCounts(state.counts, shift);
    if (state.context && isWeekend(state.context, day) && isWorkShift(shift)) {
        state.counts.weekendWork++;
    }

    const cell = state.cells[day];
    cell.dataset.shift = shift;
    cell.textContent = getShiftDisplayName(shift);

    if (shift) {
        cell.dataset.source = "auto";
        cell.dataset.autoAssigned = "true";
        cell.classList.add("autoAssignedCell");
    } else {
        delete cell.dataset.source;
        delete cell.dataset.autoAssigned;
        cell.classList.remove("autoAssignedCell");
    }

    return true;

}

function refreshAutoCounts(state, context) {

    state.counts = getEmptyCounts();

    state.shifts.forEach((shift, day) => {
        addShiftToCounts(state.counts, shift);
        if (isWeekend(context, day) && isWorkShift(shift)) {
            state.counts.weekendWork++;
        }
    });

}

function chooseRestDay(context, state) {

    let bestDay = -1;
    let bestScore = -Infinity;

    for (let day = 0; day < context.days; day++) {

        if (state.fixed[day] || state.shifts[day] !== "") continue;

        let score = 0;
        if (getConsecutiveWorkDays(state, day - 1) >= AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays - 1) score += 30;
        if (state.shifts[day - 1] === "休" || state.shifts[day + 1] === "休") score += 18;
        if (isWeekend(context, day)) score -= 2;
        score += countWorkDays(state) - countRestDays(state);

        if (score > bestScore) {
            bestScore = score;
            bestDay = day;
        }

    }

    return bestDay;

}

function scoreCandidate(context, state, day, shift) {

    let score = countWorkDays(state) * 18;

    if (isNightShift(shift)) score += state.counts.night * 10;
    if (shift === "早①") score += state.counts.early1 * 9;
    if (shift === "早②") score += state.counts.early2 * 9;
    if (shift === "遅") score += state.counts.late * 9;
    if (isWeekend(context, day)) score += state.counts.weekendWork * 8;

    const consecutive = getConsecutiveWorkDaysIfAssigned(state, day, shift);
    score += consecutive * 4;
    if (consecutive >= 4) score += 20;

    score += getProjectedCategoryTargetPenalty(state, shift) * 16;
    score += getProjectedLateStandardPenalty(state, shift) * 18;
    score += getProjectedWorkStreakPenalty(state, day, shift) * 4;
    score += getProjectedNight1RunPenalty(state, day, shift) * 4;
    score += getProjectedTransitionPenalty(state, day, shift) * 2;
    score += getExplorationBias(context, state, day, shift);

    return score;

}

function getProjectedCategoryTargetPenalty(state, shift) {

    if (!isWorkShift(shift) && !isRestShift(shift)) return 0;

    const counts = getCategoryCounts(state);
    if (isEarlyShift(shift)) counts.early++;
    if (shift === "遅") counts.late++;
    if (isNightShift(shift)) counts.night++;
    if (isRestShift(shift)) counts.rest++;

    return getCategoryTargetDistance(counts);

}

function getProjectedLateStandardPenalty(state, shift) {

    if (!isWorkShift(shift) && !isRestShift(shift)) return 0;

    const counts = getCategoryCounts(state);
    if (isEarlyShift(shift)) counts.early++;
    if (shift === "遅") counts.late++;
    if (isNightShift(shift)) counts.night++;
    if (isRestShift(shift)) counts.rest++;

    return getLateStandardDistance(counts);

}

function scoreSetCandidate(context, state, day, shift) {

    let score = scoreCandidate(context, state, day, shift);
    score += getNightSetWeekendBalancePenalty(context, state, day, shift);

    const workValues = context.staffStates.map(candidate => {
        return countWorkDays(candidate) + (candidate === state && isWorkShift(shift) ? 1 : 0);
    });

    const workRange = getRange(workValues);
    score += workRange * 28;
    if (workRange >= 3) score += 80;

    return score;

}

function getNightSetWeekendBalancePenalty(context, state, day, shift) {

    if (!isNightShift(shift)) return 0;
    if (day + 1 >= context.days) return 0;
    if (!isWeekend(context, day + 1)) return 0;
    if (state.shifts[day + 1] !== "") return 0;

    const currentValues = context.staffStates.map(candidate => candidate.counts.weekendWork);
    const currentRange = getRange(currentValues);
    if (currentRange < 2) return 0;

    const maxWeekendWork = Math.max(...currentValues);
    const lowWeekendGap = Math.max(0, maxWeekendWork - state.counts.weekendWork);

    return lowWeekendGap * AUTO_SHIFT_CONFIG.nightBeforeWeekendLowCountWeight;

}

function getExplorationBias(context, state, day, shift) {

    if (context.attempt === 0) return 0;

    const shiftIndex = SHIFT_MASTER.indexOf(shift);
    const hash = (state.staff.id * 17 + day * 11 + shiftIndex * 7 + context.attempt * 13) % 10;
    return hash / 3;

}

function scoreAutoShiftPlan(context) {

    const ranges = getImbalanceRanges(context);
    const category = getCategoryEvaluation(context);

    return {
        violations: countAbsoluteViolations(context),
        blanks: countBlankCells(context),
        workRange: ranges.work,
        categoryTargetPenalty: category.targetPenalty,
        categoryRangePenalty: category.rangePenalty,
        categoryMaxRange: category.maxRange,
        lateStandardPenalty: category.lateStandardPenalty,
        earlyRange: ranges.early,
        restRange: ranges.rest,
        nightRange: ranges.night,
        early1Range: ranges.early1,
        early2Range: ranges.early2,
        lateRange: ranges.late,
        weekendRange: ranges.weekendWork,
        missingDoubleRest: countMissingDoubleRest(context),
        restPatternPenalty: getRestPatternPenalty(context),
        workStreakPenalty: getWorkStreakPatternPenalty(context),
        night1RunPenalty: getNight1RunPatternPenalty(context),
        transitionPenalty: getTransitionPatternPenalty(context)
    };

}

function getCategoryEvaluation(context) {

    const categories = ["early", "late", "night", "rest"];
    const ranges = getImbalanceRanges(context);
    const targetPenalty = context.staffStates.reduce((total, state) => {
        return total + getCategoryTargetDistance(getCategoryCounts(state));
    }, 0);
    const lateStandardPenalty = context.staffStates.reduce((total, state) => {
        return total + getLateStandardDistance(getCategoryCounts(state));
    }, 0);

    const rangePenalty = categories.reduce((total, key) => {
        return total + Math.max(0, ranges[key] - 1);
    }, 0);

    return {
        targetPenalty,
        lateStandardPenalty,
        rangePenalty,
        maxRange: Math.max(...categories.map(key => ranges[key]))
    };

}

function getCategoryTargetDistance(counts) {

    return getRangeDistance(counts.early, AUTO_SHIFT_CONFIG.minEarlyCount, AUTO_SHIFT_CONFIG.maxEarlyCount)
        + getRangeDistance(counts.late, AUTO_SHIFT_CONFIG.minLateCount, AUTO_SHIFT_CONFIG.maxLateCount)
        + getRangeDistance(counts.night, AUTO_SHIFT_CONFIG.minNightCount, AUTO_SHIFT_CONFIG.maxNightCount)
        + getRangeDistance(counts.rest, AUTO_SHIFT_CONFIG.minRestDays, AUTO_SHIFT_CONFIG.maxRestDays);

}

function getLateStandardDistance(counts) {

    if (counts.late >= AUTO_SHIFT_CONFIG.targetLateCount) return 0;
    return AUTO_SHIFT_CONFIG.targetLateCount - counts.late;

}

function getProjectedWorkStreakPenalty(state, day, shift) {

    if (!isWorkShift(shift)) return 0;

    const consecutive = getConsecutiveWorkDaysIfAssigned(state, day, shift);
    return getWorkStreakLengthPenalty(consecutive);

}

function getProjectedNight1RunPenalty(state, day, shift) {

    if (shift !== "夜①") return 0;

    const consecutive = getExactShiftRunLengthIfAssigned(state, day, shift);
    return getNight1RunLengthPenalty(consecutive);

}

function getProjectedTransitionPenalty(state, day, shift) {

    if (!shift) return 0;

    let penalty = 0;
    const previousShift = getPreviousShift(state, day);
    const nextShift = state.shifts[day + 1] || "";

    if (previousShift) {
        penalty += getShiftTransitionPenalty(previousShift, shift);
    }

    if (nextShift) {
        penalty += getShiftTransitionPenalty(shift, nextShift);
    }

    return penalty;

}

function getRestPatternPenalty(context) {

    const targetDoubleRestCount = context.staffStates.length;

    const result = context.staffStates.reduce((total, state) => {
        let doubleRestCount = 0;
        let penalty = 0;
        let streak = 0;

        state.shifts.forEach(shift => {
            if (isRestShift(shift)) {
                streak++;
            } else {
                if (streak >= 2) doubleRestCount += streak - 1;
                if (streak >= 3) penalty += (streak - 2) * 4;
                streak = 0;
            }
        });

        if (streak >= 2) doubleRestCount += streak - 1;
        if (streak >= 3) penalty += (streak - 2) * 4;

        return total + penalty + Math.max(0, doubleRestCount - 1) * 2;
    }, 0);

    const totalDoubleRestCount = context.staffStates.reduce((total, state) => {
        let count = 0;
        for (let day = 0; day < state.shifts.length - 1; day++) {
            if (isRestShift(state.shifts[day]) && isRestShift(state.shifts[day + 1])) count++;
        }
        return total + count;
    }, 0);

    return result + Math.max(0, totalDoubleRestCount - targetDoubleRestCount) * 2;

}

function getWorkStreakPatternPenalty(context) {

    return context.staffStates.reduce((total, state) => {
        let streak = state.previousConsecutiveWork || 0;
        let penalty = 0;

        state.shifts.forEach(shift => {
            if (isWorkShift(shift)) {
                streak++;
            } else {
                if (streak > 0) penalty += getWorkStreakLengthPenalty(streak);
                streak = 0;
            }
        });

        if (streak > 0) penalty += getWorkStreakLengthPenalty(streak);

        return total + penalty;
    }, 0);

}

function getWorkStreakLengthPenalty(length) {

    if (length <= 0) return 0;
    if (length === 3) return 0;
    if (length === 2) return 1;
    if (length === 4) return 2;
    if (length === 1) return 4;
    if (length === 5) return 12;
    return 20;

}

function getNight1RunPatternPenalty(context) {

    return context.staffStates.reduce((total, state) => {
        let streak = 0;
        let penalty = 0;

        state.shifts.forEach(shift => {
            if (shift === "夜①") {
                streak++;
            } else {
                if (streak > 0) penalty += getNight1RunLengthPenalty(streak);
                streak = 0;
            }
        });

        if (streak > 0) penalty += getNight1RunLengthPenalty(streak);

        return total + penalty;
    }, 0);

}

function getNight1RunLengthPenalty(length) {

    if (length <= 0) return 0;
    if (length === 2) return 0;
    if (length === 3) return 1;
    if (length === 1) return 2;
    if (length >= 4) return 72 + (length - 4) * 24;
    return 0;

}

function getTransitionPatternPenalty(context) {

    return context.staffStates.reduce((total, state) => {
        let penalty = 0;

        for (let day = 0; day < state.shifts.length - 1; day++) {
            penalty += getShiftTransitionPenalty(state.shifts[day], state.shifts[day + 1]);
        }

        return total + penalty;
    }, 0);

}

function getShiftTransitionPenalty(fromShift, toShift) {

    const exactPreferred = {
        "夜①→休": -1,
        "夜①→夜①": -5,
        "夜①→夜②": 0,
        "夜②→休": -4
    };
    const exactKey = `${fromShift}→${toShift}`;
    if (exactPreferred[exactKey] !== undefined) return exactPreferred[exactKey];

    const from = getShiftCategory(fromShift);
    const to = getShiftCategory(toShift);

    if (!from || !to) return 0;

    const preferred = {
        "夜→休": -2,
        "夜→夜": -3,
        "遅→夜": -3,
        "遅→遅": -4,
        "休→早": -3,
        "早→早": -4,
        "早→遅": -1
    };

    const key = `${from}→${to}`;
    if (preferred[key] !== undefined) return preferred[key];

    if (from === "夜" && (to === "早" || to === "遅")) return 6;
    if (from === "遅" && to === "早") return 2;
    if (from === "休" && to === "夜") return 1;
    if (from === "早" && to === "夜") return 1;

    return 0;

}

function getShiftCategory(shift) {

    if (!shift) return "";
    if (isRestShift(shift)) return "休";
    if (isEarlyShift(shift)) return "早";
    if (shift === "遅") return "遅";
    if (isNightShift(shift)) return "夜";
    return "";

}

function getRangeDistance(value, min, max) {

    if (value < min) return min - value;
    if (value > max) return value - max;
    return 0;

}

function getCategoryCounts(state) {

    return {
        early: state.counts.early,
        late: state.counts.late,
        night: state.counts.night,
        rest: countRestDays(state)
    };

}

function countMissingDoubleRest(context) {

    return context.staffStates.filter(state => !hasConsecutiveRest(state)).length;

}

function countAbsoluteViolations(context) {

    let count = 0;

    context.staffStates.forEach(state => {
        const restDays = countRestDays(state);
        if (restDays < AUTO_SHIFT_CONFIG.minRestDays || restDays > AUTO_SHIFT_CONFIG.maxRestDays) {
            count += Math.abs(restDays - clamp(restDays, AUTO_SHIFT_CONFIG.minRestDays, AUTO_SHIFT_CONFIG.maxRestDays)) + 1;
        }

        count += findLongWorkRanges(state).length * 5;
        if (hasPersonalNightConnectionViolation(state)) count += 5;
    });

    for (let day = 0; day < context.days - 1; day++) {
        const night1Staff = context.staffStates.find(state => state.shifts[day] === "夜①");
        if (night1Staff && !hasShiftByOtherStaff(context, day + 1, "早①", night1Staff)) count += 3;

        const date = new Date(context.year, context.month - 1, day + 1);
        const night2Staff = context.staffStates.find(state => state.shifts[day] === "夜②");
        if (date.getDay() === 3 && night2Staff && !hasShiftByOtherStaff(context, day + 1, "早②", night2Staff)) count += 3;
    }

    return count;

}

function countBlankCells(context) {

    return context.staffStates.reduce((total, state) => {
        return total + state.shifts.filter(shift => shift === "").length;
    }, 0);

}

function getImbalanceRanges(context) {

    return {
        early: getRange(context.staffStates.map(state => state.counts.early)),
        night: getRange(context.staffStates.map(state => state.counts.night)),
        early1: getRange(context.staffStates.map(state => state.counts.early1)),
        early2: getRange(context.staffStates.map(state => state.counts.early2)),
        late: getRange(context.staffStates.map(state => state.counts.late)),
        rest: getRange(context.staffStates.map(countRestDays)),
        weekendWork: getRange(context.staffStates.map(state => state.counts.weekendWork)),
        work: getRange(context.staffStates.map(countWorkDays))
    };

}

function createShiftPlanFingerprint(context) {

    return context.staffStates
        .map(state => `${state.staff.id}:${state.shifts.join("|")}`)
        .join(";");

}

function getRange(values) {

    if (values.length <= 1) return 0;
    return Math.max(...values) - Math.min(...values);

}

function clamp(value, min, max) {

    return Math.min(max, Math.max(min, value));

}

function validateAutoShift(context) {

    const warnings = [];
    clearWarningCells();

    context.staffStates.forEach(state => {

        state.shifts.forEach((shift, day) => {
            if (shift === "") {
                warnings.push(`⚠ ${state.staff.name}さん：${day + 1}日が空白のままです`);
                markCells(state, day, day);
            }
        });

        const restDays = countRestDays(state);
        if (restDays < AUTO_SHIFT_CONFIG.minRestDays || restDays > AUTO_SHIFT_CONFIG.maxRestDays) {
            warnings.push(`⚠ ${state.staff.name}さん：今月の休日数が${restDays}日です`);
            markStaffCells(state);
        }

        const longWorkRanges = findLongWorkRanges(state);
        longWorkRanges.forEach(range => {
            warnings.push(`⚠ ${state.staff.name}さん：${range.start}日～${range.end}日が${range.length}連勤です`);
            markCells(state, range.start - 1, range.end - 1);
        });

        for (let day = 0; day < context.days - 1; day++) {
            const shift = state.shifts[day];
            const nextShift = state.shifts[day + 1];

            if (isNightShift(shift) && (isEarlyShift(nextShift) || nextShift === "遅")) {
                warnings.push(`⚠ ${state.staff.name}さん：${day + 1}日の夜勤翌日に${day + 2}日${getShiftDisplayName(nextShift)}が入っています`);
                markCells(state, day, day + 1);
            }

            if (shift === "夜②" && nextShift !== "休") {
                warnings.push(`⚠ ${state.staff.name}さん：夜②翌日の${day + 2}日が休みではありません`);
                markCells(state, day, day + 1);
            }
        }

        if (!hasConsecutiveRest(state)) {
            warnings.push(`⚠ ${state.staff.name}さん：2連休がありません`);
        }

    });

    for (let day = 0; day < context.days - 1; day++) {

        const night1Staff = context.staffStates.find(state => state.shifts[day] === "夜①");
        if (night1Staff && !hasShiftByOtherStaff(context, day + 1, "早①", night1Staff)) {
            warnings.push(`⚠ ${day + 1}日${getShiftDisplayName("夜①")}の翌日${day + 2}日に、別社員の${getShiftDisplayName("早①")}がありません`);
        }

        const date = new Date(context.year, context.month - 1, day + 1);
        const night2Staff = context.staffStates.find(state => state.shifts[day] === "夜②");
        if (date.getDay() === 3 && night2Staff && !hasShiftByOtherStaff(context, day + 1, "早②", night2Staff)) {
            warnings.push(`⚠ 水曜${day + 1}日夜②の翌日${day + 2}日に、別社員の早②がありません`);
        }

    }

    addImbalanceWarnings(context, warnings);

    if (warnings.length === 0) {
        warnings.push("自動作成が完了しました。必要に応じて手直ししてください。");
    }

    return warnings;

}

function showAutoWarnings(warnings) {

    const area = getAutoWarningArea();
    area.innerHTML = warnings.map(message => `<div>${message}</div>`).join("");
    area.hidden = warnings.length === 0;

}

function clearAutoWarnings() {

    const area = document.getElementById("autoWarnings");
    if (area) {
        area.innerHTML = "";
        area.hidden = true;
    }
    clearWarningCells();

}

function getAutoWarningArea() {

    let area = document.getElementById("autoWarnings");
    if (area) return area;

    area = document.createElement("section");
    area.id = "autoWarnings";
    area.className = "autoWarnings";
    area.hidden = true;

    const wrapper = document.querySelector(".tableWrapper");
    wrapper.parentNode.insertBefore(area, wrapper);

    return area;

}

function writeAutoShiftToTable(context) {

    context.staffStates.forEach(state => {
        state.shifts.forEach((shift, day) => {
            if (state.fixed[day]) return;

            const cell = state.cells[day];
            cell.dataset.shift = shift;
            cell.textContent = getShiftDisplayName(shift);

            if (shift) {
                cell.dataset.source = "auto";
                cell.dataset.autoAssigned = "true";
                cell.classList.add("autoAssignedCell");
            } else {
                delete cell.dataset.source;
                delete cell.dataset.autoAssigned;
                cell.classList.remove("autoAssignedCell");
            }
        });
    });

}

function getPreviousShifts(previousData, staffId) {

    if (!previousData || !Array.isArray(previousData.rows)) return [];

    const row = previousData.rows.find(item => Number(item.staffId) === Number(staffId));
    return row && Array.isArray(row.shifts) ? row.shifts : [];

}

function getPreviousMonthValue(year, month) {

    const previous = new Date(year, month - 2, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;

}

function hasShiftOnDay(context, day, shift) {

    return context.staffStates.some(state => state.shifts[day] === shift);

}

function hasShiftByOtherStaff(context, day, shift, excludedState) {

    return context.staffStates.some(state => state !== excludedState && state.shifts[day] === shift);

}

function isWeekend(context, day) {

    const week = new Date(context.year, context.month - 1, day + 1).getDay();
    return week === 0 || week === 6;

}

function getPreviousShift(state, day) {

    if (day > 0) return state.shifts[day - 1];
    return state.previousLastShift || "";

}

function getConsecutiveWorkDaysIfAssigned(state, day, shift) {

    const original = state.shifts[day];
    state.shifts[day] = shift;
    const count = getConsecutiveWorkDays(state, day);
    state.shifts[day] = original;
    return count;

}

function getExactShiftRunLengthIfAssigned(state, day, shift) {

    const original = state.shifts[day];
    state.shifts[day] = shift;

    let start = day;
    while (start > 0 && state.shifts[start - 1] === shift) start--;

    let end = day;
    while (end < state.shifts.length - 1 && state.shifts[end + 1] === shift) end++;

    state.shifts[day] = original;
    return end - start + 1;

}

function getConsecutiveWorkDays(state, day) {

    if (day < 0) return state.previousConsecutiveWork || 0;

    let count = 0;
    for (let i = day; i >= 0; i--) {
        if (!isWorkShift(state.shifts[i])) break;
        count++;
    }

    if (day - count < 0) {
        count += state.previousConsecutiveWork || 0;
    }

    return count;

}

function countTrailingWorkDays(shifts) {

    let count = 0;
    for (let i = shifts.length - 1; i >= 0; i--) {
        if (!isWorkShift(shifts[i])) break;
        count++;
    }
    return count;

}

function findLongWorkRanges(state) {

    const ranges = [];
    let start = null;
    let length = state.previousConsecutiveWork || 0;

    for (let day = 0; day < state.shifts.length; day++) {
        if (isWorkShift(state.shifts[day])) {
            if (start === null) start = Math.max(0, day - length);
            length++;
        } else {
            if (length > AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays) {
                ranges.push({ start: start + 1, end: day, length });
            }
            start = null;
            length = 0;
        }
    }

    if (length > AUTO_SHIFT_CONFIG.maxConsecutiveWorkDays) {
        ranges.push({ start: (start || 0) + 1, end: state.shifts.length, length });
    }

    return ranges;

}

function findBlankDayInRange(state, start, end) {

    for (let day = end; day >= start; day--) {
        if (!state.fixed[day] && state.shifts[day] === "") return day;
    }
    return -1;

}

function countRestDays(state) {

    return state.shifts.filter(isRestShift).length;

}

function countWorkDays(state) {

    return state.shifts.filter(isWorkShift).length;

}

function hasConsecutiveRest(state) {

    for (let day = 0; day < state.shifts.length - 1; day++) {
        if (isRestShift(state.shifts[day]) && isRestShift(state.shifts[day + 1])) return true;
    }
    return false;

}

function getRestDays(state) {

    return state.shifts
        .map((shift, day) => ({ shift, day }))
        .filter(item => isRestShift(item.shift))
        .map(item => item.day);

}

function markStaffCells(state) {

    state.cells.forEach(cell => cell.classList.add("autoWarningCell"));

}

function markCells(state, start, end) {

    for (let day = start; day <= end; day++) {
        if (state.cells[day]) state.cells[day].classList.add("autoWarningCell");
    }

}

function clearWarningCells() {

    document.querySelectorAll(".autoWarningCell").forEach(cell => {
        cell.classList.remove("autoWarningCell");
    });

}

function addImbalanceWarnings(context, warnings) {

    [
        { key: "night", label: "夜勤回数" },
        { key: "early1", label: `${getShiftDisplayName("早①")}回数` },
        { key: "early2", label: "早②回数" },
        { key: "late", label: "遅番回数" },
        { key: "weekendWork", label: "土日勤務回数" },
        { key: "work", label: "総勤務回数", value: countWorkDays }
    ].forEach(item => {
        const values = context.staffStates.map(state => item.value ? item.value(state) : state.counts[item.key]);
        if (values.length <= 1) return;

        const max = Math.max(...values);
        const min = Math.min(...values);

        if (max - min >= AUTO_SHIFT_CONFIG.largeImbalanceThreshold) {
            warnings.push(`⚠ ${item.label}に大きな偏りがあります`);
        }
    });

}

function getShiftCount(state, shift) {

    if (shift === "早①") return state.counts.early1;
    if (shift === "早②") return state.counts.early2;
    if (shift === "遅") return state.counts.late;
    if (isNightShift(shift)) return state.counts.night;
    return 0;

}

function getEmptyCounts() {

    return {
        early: 0,
        early1: 0,
        early2: 0,
        late: 0,
        night: 0,
        rest: 0,
        weekendWork: 0
    };

}

function addShiftToCounts(counts, shift) {

    if (shift === "早①") {
        counts.early++;
        counts.early1++;
    } else if (shift === "早②") {
        counts.early++;
        counts.early2++;
    } else if (shift === "遅") {
        counts.late++;
    } else if (isNightShift(shift)) {
        counts.night++;
    } else if (isRestShift(shift)) {
        counts.rest++;
    }

}

function removeShiftFromCounts(counts, shift) {

    if (shift === "早①") {
        counts.early--;
        counts.early1--;
    } else if (shift === "早②") {
        counts.early--;
        counts.early2--;
    } else if (shift === "遅") {
        counts.late--;
    } else if (isNightShift(shift)) {
        counts.night--;
    } else if (isRestShift(shift)) {
        counts.rest--;
    }

}

function isEarlyShift(shift) {
    return shift === "早①" || shift === "早②";
}

function isNightShift(shift) {
    return shift === "夜①" || shift === "夜②";
}

function isRestShift(shift) {
    return shift === "休" || shift === "有";
}

function isWorkShift(shift) {
    return shift !== "" && !isRestShift(shift);
}
