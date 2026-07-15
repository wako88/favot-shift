// =========================
// table.js
// シフト表作成
// =========================

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

function buildTable(){

    const [year, month] = monthInput.value.split("-");

    const days = new Date(year, month, 0).getDate();

    createHeader(year, month, days);

    createRows(days);

    attachCellEvents();

}
function createHeader(year, month, days){

    let html = "<tr>";

    for(let day=1; day<=days; day++){

        const date = new Date(year, month-1, day);

        const week = ["日","月","火","水","木","金","土"][date.getDay()];

        let cls = "";

        if(date.getDay() === 6) cls = "sat";

        if(date.getDay() === 0) cls = "sun";

        html += `
            <th class="${cls}">
                ${day}
                <small>${week}</small>
            </th>
        `;

    }

    html += "</tr>";

    shiftHead.innerHTML = html;

}

function createRows(days){

    let staffHtml = "";

    let shiftHtml = "";

    staffList.forEach(staff=>{

        staffHtml += `
            <tr>
                <td>${staff.name}</td>
            </tr>
        `;

        shiftHtml += "<tr>";

        for(let i=1;i<=days;i++){

            shiftHtml += `<td data-shift=""></td>`;

        }

        shiftHtml += "</tr>";

    });

    staffBody.innerHTML = staffHtml;

    shiftBody.innerHTML = shiftHtml;

}
function attachCellEvents(){

    const cells = document.querySelectorAll("#shiftBody td");

    cells.forEach(cell=>{

        cell.addEventListener("click",()=>{

            let current = cell.dataset.shift || "";

            let index = SHIFT_MASTER.indexOf(current);

            index++;

            if(index >= SHIFT_MASTER.length){

                index = 0;

            }

            current = SHIFT_MASTER[index];

            cell.dataset.shift = current;

            cell.textContent = current;

            updateSummary();

            saveData();

        });

    });

}
function updateSummary(){

    // Ver1.0では勤務回数表示をここで更新する
    // （summary.jsは作らず、この関数で集計する）

}

function refreshTable(){

    buildTable();

}

console.log("table.js 読み込み完了");