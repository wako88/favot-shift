// =========================
// Favot Shift Ver1.0
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

let staffList = [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
    { id: 3, name: "C" },
    { id: 4, name: "D" }
];

const monthInput = document.getElementById("monthSelect");

const staffBody = document.getElementById("staffBody");
const shiftHead = document.getElementById("shiftHead");
const shiftBody = document.getElementById("shiftBody");

const today = new Date();

monthInput.value =
`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;

monthInput.addEventListener("change", buildTable);

buildTable();
function buildTable(){

    const [year,month] = monthInput.value.split("-");

    const days = new Date(year,month,0).getDate();

    createHeader(year,month,days);

    createRows(days);

    attachCellEvents();

}

function createHeader(year,month,days){

    let html="<tr>";

    for(let day=1;day<=days;day++){

        const date=new Date(year,month-1,day);

        const week=["日","月","火","水","木","金","土"][date.getDay()];

        let cls="";

        if(date.getDay()===6) cls="sat";

        if(date.getDay()===0) cls="sun";

        html+=`
            <th class="${cls}">
                ${day}
                <small>${week}</small>
            </th>
        `;

    }

    html+="</tr>";

    shiftHead.innerHTML=html;

}

function createRows(days){

    let leftHtml="";

    let rightHtml="";

    staffList.forEach(staff=>{

        leftHtml+=`
            <tr>
                <td>${staff.name}</td>
            </tr>
        `;

        rightHtml+="<tr>";

        for(let i=1;i<=days;i++){

            rightHtml+=`<td data-shift=""></td>`;

        }

        rightHtml+="</tr>";

    });

    staffBody.innerHTML=leftHtml;

    shiftBody.innerHTML=rightHtml;

}
function attachCellEvents(){

    const cells=document.querySelectorAll("#shiftBody td");

    cells.forEach(cell=>{

        cell.addEventListener("click",()=>{

            let current=cell.dataset.shift;

            let index=SHIFT_MASTER.indexOf(current);

            index++;

            if(index>=SHIFT_MASTER.length){

                index=0;

            }

            current=SHIFT_MASTER[index];

            cell.dataset.shift=current;

            cell.textContent=current;

            saveData();

            updateCount();

        });

    });

}

function updateCount(){

    // Ver1.0 Part5で実装

}
function saveData(){

    const data={

        month:monthInput.value,

        staff:staffList,

        shifts:[]

    };

    document.querySelectorAll("#shiftBody tr").forEach(row=>{

        const list=[];

        row.querySelectorAll("td").forEach(cell=>{

            list.push(cell.dataset.shift);

        });

        data.shifts.push(list);

    });

    localStorage.setItem("favotShiftVer1",JSON.stringify(data));

}

function loadData(){

    const json=localStorage.getItem("favotShiftVer1");

    if(!json){

        return;

    }

    const data=JSON.parse(json);

    if(data.month){

        monthInput.value=data.month;

    }

    if(data.staff){

        staffList=data.staff;

    }

}

loadData();

buildTable();
// =========================
// スタッフ管理
// =========================

const staffDialog = document.getElementById("staffDialog");
const staffBtn = document.getElementById("staffBtn");
const closeStaffBtn = document.getElementById("closeStaffBtn");
const staffListArea = document.getElementById("staffList");
const addStaffBtn = document.getElementById("addStaffBtn");

staffBtn.addEventListener("click",()=>{

    alert("スタッフ管理は次のPartで実装します。");

});

document.getElementById("printBtn").addEventListener("click",()=>{

    window.print();

});

document.getElementById("createBtn").addEventListener("click",()=>{

    alert("自動シフト作成はVer1.0完成後に実装します。");

});

console.log("🍃 Favot Shift Ver1.0");