// Configuração do Firebase (substitua com suas credenciais)
const firebaseConfig = {
    apiKey: "AIzaSyC740BTceOaBZn-cLgJVAsxDkQf6m4yIcs",
    authDomain: "trading-app-6cc63.firebaseapp.com",
    projectId: "trading-app-6cc63",
    storageBucket: "trading-app-6cc63.firebasestorage.app",
    messagingSenderId: "881831434161",
    appId: "1:881831434161:web:cc0f8c13ba4972daaf8f90"
  };

// Inicialize o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variáveis globais
let operations = [];
let currentUser = null;
let capitalChart, monthlyPerformanceChart, yearlyPerformanceChart, drawdownChart;

// Observador de autenticação
auth.onAuthStateChanged(user => {
  currentUser = user;
  const userEmailElement = document.getElementById('user-email');
  
  if (userEmailElement) {
    userEmailElement.textContent = user ? user.email : 'Visitante';
  }

  if (user) {
    console.log("Usuário logado:", user.email);
    loadOperations();
    
    // Se estiver na página de login/registro, redireciona para o app
    if (window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('register.html')) {
      window.location.href = "index.html";
    }
  } else {
    console.log("Usuário não logado");
    // Se não estiver nas páginas de auth, redireciona para login
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
      window.location.href = "login.html";
    }
  }
});

// ================== FUNÇÕES DE AUTENTICAÇÃO ================== //
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('error-message');

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    errorElement.textContent = error.message;
    console.error("Erro no login:", error);
  }
}

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
    console.error("Erro no login com Google:", error);
  }
}

async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('error-message');

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    // Cria a estrutura inicial no Firestore
    await db.collection("users").doc(userCredential.user.uid).set({
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    errorElement.textContent = error.message;
    console.error("Erro no registro:", error);
  }
}

async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
}

// ================== FUNÇÕES DO APP ================== //
async function loadOperations() {
  if (!currentUser) return;
  
  try {
    const snapshot = await db.collection("users").doc(currentUser.uid)
      .collection("operations")
      .orderBy("date", "desc")
      .get();
    
    operations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    renderOperations();
    updateAllAnalyses();
  } catch (error) {
    console.error("Erro ao carregar operações:", error);
  }
}

async function addOperation() {
  if (!currentUser) return;

  const newOperation = {
    date: new Date().toISOString().split('T')[0],
    asset: '',
    direction: 'Long',
    entryValue: 0,
    entryPrice: 0,
    exitPrice: 0,
    leverage: 1,
    setup: '',
    entryFee: 0,
    exitFee: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("operations").add(newOperation);
  } catch (error) {
    console.error("Erro ao adicionar operação:", error);
    alert("Erro ao adicionar: " + error.message);
  }
}

async function updateOperation(id, field, value) {
  if (!currentUser) return;

  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("operations").doc(id).update({
        [field]: isNaN(value) ? value : Number(value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (error) {
    console.error("Erro ao atualizar operação:", error);
  }
}

async function deleteOperation(id) {
  if (!currentUser) return;

  if (!confirm("Tem certeza que deseja excluir esta operação?")) return;

  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("operations").doc(id).delete();
  } catch (error) {
    console.error("Erro ao excluir operação:", error);
    alert("Erro ao excluir: " + error.message);
  }
}

// ================== FUNÇÕES DE RENDERIZAÇÃO (MANTIDAS DO SEU CÓDIGO) ================== //
function renderOperations() {
  const tbody = document.getElementById('operations-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  operations.forEach(op => {
    const resultDollar = calculateResultDollar(op);
    const resultPercent = calculateResultPercent(op, resultDollar);
    const totalFees = calculateTotalFees(op);
    const netResult = resultDollar - totalFees;
    
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td><input type="date" value="${op.date}" onchange="updateOperation('${op.id}', 'date', this.value)"></td>
      <td><input type="text" value="${op.asset}" onchange="updateOperation('${op.id}', 'asset', this.value)" placeholder="Ex: BTC, ETH"></td>
      <td>
        <select onchange="updateOperation('${op.id}', 'direction', this.value)">
          <option value="Long" ${op.direction === 'Long' ? 'selected' : ''}>Long</option>
          <option value="Short" ${op.direction === 'Short' ? 'selected' : ''}>Short</option>
        </select>
      </td>
      <td><input type="number" step="0.01" value="${op.entryValue}" onchange="updateOperation('${op.id}', 'entryValue', this.value)"></td>
      <td><input type="number" step="0.0001" value="${op.entryPrice}" onchange="updateOperation('${op.id}', 'entryPrice', this.value)"></td>
      <td><input type="number" step="0.0001" value="${op.exitPrice}" onchange="updateOperation('${op.id}', 'exitPrice', this.value)"></td>
      <td><input type="number" min="1" value="${op.leverage}" onchange="updateOperation('${op.id}', 'leverage', this.value)"></td>
      <td><input type="text" value="${op.setup}" onchange="updateOperation('${op.id}', 'setup', this.value)" placeholder="Ex: Romper de lateral"></td>
      <td><input type="number" step="0.01" value="${op.entryFee}" onchange="updateOperation('${op.id}', 'entryFee', this.value)" placeholder="0.00"></td>
      <td><input type="number" step="0.01" value="${op.exitFee}" onchange="updateOperation('${op.id}', 'exitFee', this.value)" placeholder="0.00"></td>
      <td class="${resultDollar >= 0 ? 'positive' : 'negative'}">${resultDollar.toFixed(2)}</td>
      <td class="${resultPercent >= 0 ? 'positive' : 'negative'}">${(resultPercent * 100).toFixed(2)}%</td>
      <td class="${netResult >= 0 ? 'positive' : 'negative'}">${netResult.toFixed(2)}</td>
      <td><button onclick="deleteOperation('${op.id}')">Excluir</button></td>
    `;
    
    tbody.appendChild(row);
  });
}

// ================== FUNÇÕES DE CÁLCULO (MANTIDAS DO SEU CÓDIGO) ================== //
function calculateResultDollar(op) {
  if (!op.entryPrice || !op.exitPrice || !op.entryValue) return 0;
  
  const priceDifference = op.direction === 'Long' ? 
    (op.exitPrice - op.entryPrice) : 
    (op.entryPrice - op.exitPrice);
  
  const positionSize = op.entryValue * op.leverage;
  return positionSize * (priceDifference / op.entryPrice);
}

function calculateResultPercent(op, resultDollar) {
  if (!op.entryValue || op.entryValue === 0) return 0;
  return resultDollar / op.entryValue;
}

function calculateTotalFees(op) {
  return (op.entryFee || 0) + (op.exitFee || 0);
}

// ================== FUNÇÕES DE ANÁLISE (MANTIDAS DO SEU CÓDIGO) ================== //
function updateAllAnalyses() {
  updateCapitalAnalysis();
  updateSetupsAnalysis();
  updateAssetsAnalysis();
  updateCharts();
}

function updateCapitalAnalysis() {
  // Mantenha sua implementação original
  // ...
}

function updateSetupsAnalysis() {
  // Mantenha sua implementação original
  // ...
}

function updateAssetsAnalysis() {
  // Mantenha sua implementação original
  // ...
}

// ================== FUNÇÕES DE GRÁFICOS (MANTIDAS DO SEU CÓDIGO) ================== //
function initCharts() {
  // Mantenha sua implementação original
  // ...
}

function updateCharts() {
  // Mantenha sua implementação original
  // ...
}

// ================== INICIALIZAÇÃO ================== //
document.addEventListener('DOMContentLoaded', function() {
  // Inicializa apenas os gráficos - os dados são carregados via loadOperations()
  if (document.getElementById('capital-chart')) {
    initCharts();
  }
  
  // Adiciona evento de logout se o botão existir
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});