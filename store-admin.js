(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const grid = $("#altofan-store-grid");
  const panel = $("#altofan-admin-panel");
  const panelBody = $("#altofan-admin-body");
  const toggle = $("#altofan-admin-toggle");

  if (!grid || !panel || !panelBody || !toggle ||
      typeof supabaseClient === "undefined") {
    console.error("ALTOFAN STORE: required elements or Supabase client missing");
    return;
  }

  let currentUser = null;
  let isOwner = false;
  let editingId = null;
  let products = [];

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);

  const money = n => Number(n).toLocaleString("ar-EG", {
    maximumFractionDigits: 2
  });

  async function refreshIdentity() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentUser = user || null;
    isOwner = false;

    if (currentUser) {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      console.log("ALTOFAN owner check:", {
        userId: currentUser.id,
        role: data?.role,
        error: error?.message
      });

      isOwner = !error && ["owner", "admin"].includes(data?.role);
    }

    // زر الدخول يظل ظاهرًا، لكن صلاحيات الإدارة للمالك فقط
    toggle.hidden = false;
  }

  function renderProducts() {
    if (!products.length) {
      grid.innerHTML = '<p class="store-note">لا توجد منتجات معروضة حاليًا.</p>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <article class="store-card">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}"
               style="width:100%;height:170px;object-fit:cover;border-radius:12px;margin-bottom:14px">`
          : `<div class="store-icon">${esc(p.icon || "🛍️")}</div>`}
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description)}</p>
        <div class="store-price">${money(p.price)}
          <small>جنيه مصري</small>
        </div>
        ${p.is_active
          ? `<a class="store-btn" href="#contact"
              data-store-order="${esc(p.id)}">اطلب المنتج</a>`
          : '<span class="store-note">المنتج مخفي</span>'}
        ${isOwner ? `
          <div class="altofan-product-admin">
            <button type="button" data-edit="${esc(p.id)}">✏️ تعديل</button>
            <button type="button" data-toggle="${esc(p.id)}">
              ${p.is_active ? "🙈 إخفاء" : "👁️ إظهار"}
            </button>
            <button type="button" data-delete="${esc(p.id)}">🗑️ حذف</button>
          </div>` : ""}
      </article>
    `).join("");
  }

  async function loadProducts() {
    grid.innerHTML = '<p class="store-note">جاري تحميل المنتجات...</p>';

    let query = supabaseClient
      .from("store_products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!isOwner) query = query.eq("is_active", true);

    const { data, error } = await query;

    if (error) {
      console.error("Store products error:", error);
      grid.innerHTML =
        '<p class="store-note">تعذر تحميل المنتجات. حاول تحديث الصفحة.</p>';
      return;
    }

    products = data || [];
    renderProducts();
  }

  function showLogin(message = "") {
    panelBody.innerHTML = `
      <h3>🔐 دخول المالك</h3>
      <p>سجّل الدخول بحساب المالك المسجّل في الموقع.</p>
      <form id="altofan-admin-login" class="altofan-admin-form">
        <label>البريد الإلكتروني
          <input name="email" type="email" required autocomplete="username">
        </label>
        <label>كلمة المرور
          <input name="password" type="password" required
                 autocomplete="current-password">
        </label>
        <button type="submit">تسجيل الدخول</button>
      </form>
      <p class="altofan-admin-message" role="status">${esc(message)}</p>
    `;
  }

  function showManager(message = "") {
    panelBody.innerHTML = `
      <h3>👑 إدارة منتجات المتجر</h3>
      <p>أضف المنتجات أو عدّل أسعارها وتحكّم في ظهورها للعملاء.</p>
      <form id="altofan-product-form" class="altofan-admin-form">
        <label>اسم المنتج
          <input name="name" maxlength="120" required>
        </label>
        <label>وصف المنتج
          <textarea name="description" maxlength="1000" rows="3"></textarea>
        </label>
        <label>السعر بالجنيه المصري
          <input name="price" type="number" min="0" step="0.01" required>
        </label>
        <label>الأيقونة (مثل 🎨 أو 👑)
          <input name="icon" maxlength="20" value="🛍️">
        </label>
        <label>رابط صورة المنتج (اختياري)
          <input name="image_url" type="url" placeholder="https://...">
        </label>
        <label>ترتيب العرض
          <input name="sort_order" type="number" value="0" step="1">
        </label>
        <label class="altofan-admin-check">
          <input name="is_active" type="checkbox" checked>
          المنتج ظاهر للعملاء
        </label>
        <div class="altofan-admin-actions">
          <button type="submit" id="altofan-save-product">➕ حفظ المنتج</button>
          <button type="button" id="altofan-cancel-edit" hidden>إلغاء التعديل</button>
        </div>
      </form>
      <p class="altofan-admin-message" role="status">${esc(message)}</p>
      <button type="button" id="altofan-admin-logout">تسجيل الخروج</button>
    `;
  }

  function resetProductForm() {
    editingId = null;
    const form = $("#altofan-product-form", panelBody);
    if (form) form.reset();

    const save = $("#altofan-save-product", panelBody);
    if (save) save.textContent = "➕ حفظ المنتج";

    const cancel = $("#altofan-cancel-edit", panelBody);
    if (cancel) cancel.hidden = true;
  }

  toggle.addEventListener("click", async () => {
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;

    await refreshIdentity();

    if (isOwner) {
      showManager();
      await loadProducts();
    } else {
      showLogin();
    }
  });

  panelBody.addEventListener("submit", async event => {
    if (event.target.id === "altofan-admin-login") {
      event.preventDefault();
      const form = event.target;
      const email = form.email.value.trim();
      const password = form.password.value;

      const { error } = await supabaseClient.auth.signInWithPassword({
        email, password
      });

      if (error) {
        showLogin("تعذر تسجيل الدخول. راجع البريد وكلمة المرور.");
        return;
      }

      await refreshIdentity();

      if (!isOwner) {
        await supabaseClient.auth.signOut();
        currentUser = null;
        showLogin("هذا الحساب ليس لديه صلاحية إدارة المتجر.");
        return;
      }

      showManager("تم تسجيل الدخول بنجاح.");
      await loadProducts();
      return;
    }

    if (event.target.id !== "altofan-product-form") return;
    event.preventDefault();

    await refreshIdentity();
    if (!isOwner) {
      showLogin("انتهت الجلسة أو لا توجد صلاحية إدارة.");
      return;
    }

    const form = event.target;
    const name = form.name.value.trim();
    const price = Number(form.price.value);

    if (!name || !Number.isFinite(price) || price < 0) {
      $(".altofan-admin-message", panelBody).textContent =
        "راجع اسم المنتج والسعر.";
      return;
    }

    const payload = {
      name,
      description: form.description.value.trim(),
      price,
      icon: form.icon.value.trim() || "🛍️",
      image_url: form.image_url.value.trim() || null,
      sort_order: Number(form.sort_order.value) || 0,
      is_active: form.is_active.checked,
      updated_at: new Date().toISOString()
    };

    const button = $("#altofan-save-product", panelBody);
    button.disabled = true;
    button.textContent = "جارٍ الحفظ...";

    let result;
    if (editingId) {
      result = await supabaseClient
        .from("store_products")
        .update(payload)
        .eq("id", editingId);
    } else {
      result = await supabaseClient
        .from("store_products")
        .insert(payload);
    }

    if (result.error) {
      console.error("Product save error:", result.error);
      $(".altofan-admin-message", panelBody).textContent =
        "لم يتم الحفظ. تأكد من صلاحيات حساب المالك في Supabase.";
      button.disabled = false;
      button.textContent = editingId ? "💾 حفظ التعديل" : "➕ حفظ المنتج";
      return;
    }

    editingId = null;
    showManager("تم حفظ المنتج بنجاح.");
    await loadProducts();
  });

  panelBody.addEventListener("click", async event => {
    if (event.target.id === "altofan-admin-logout") {
      await supabaseClient.auth.signOut();
      await refreshIdentity();
      showLogin("تم تسجيل الخروج.");
      await loadProducts();
      return;
    }

    if (event.target.id === "altofan-cancel-edit") {
      resetProductForm();
      return;
    }
  });

  grid.addEventListener("click", async event => {
    const orderButton = event.target.closest("[data-store-order]");
    if (orderButton) {
      const product = products.find(p => p.id === orderButton.dataset.storeOrder);
      if (product && product.is_active) {
        altofanStoreOrder(`${product.name} - ${money(product.price)} EGP`);
      }
      return;
    }

    if (!isOwner) return;

    const edit = event.target.closest("[data-edit]");
    const hide = event.target.closest("[data-toggle]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
      const p = products.find(x => x.id === edit.dataset.edit);
      if (!p) return;

      if (panel.hidden) panel.hidden = false;
      showManager();

      const form = $("#altofan-product-form", panelBody);
      form.name.value = p.name;
      form.description.value = p.description || "";
      form.price.value = p.price;
      form.icon.value = p.icon || "🛍️";
      form.image_url.value = p.image_url || "";
      form.sort_order.value = p.sort_order || 0;
      form.is_active.checked = !!p.is_active;

      editingId = p.id;
      $("#altofan-save-product", panelBody).textContent = "💾 حفظ التعديل";
      $("#altofan-cancel-edit", panelBody).hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (hide) {
      const p = products.find(x => x.id === hide.dataset.toggle);
      if (!p) return;

      const { error } = await supabaseClient
        .from("store_products")
        .update({
          is_active: !p.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", p.id);

      if (error) {
        alert("تعذر تغيير حالة المنتج. راجع صلاحيات المالك.");
        return;
      }

      await loadProducts();
      return;
    }

    if (del) {
      const p = products.find(x => x.id === del.dataset.delete);
      if (!p || !confirm(`هل تريد حذف "${p.name}" نهائيًا؟`)) return;

      const { error } = await supabaseClient
        .from("store_products")
        .delete()
        .eq("id", p.id);

      if (error) {
        alert("تعذر حذف المنتج. راجع صلاحيات المالك.");
        return;
      }

      await loadProducts();
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    await refreshIdentity();
    await loadProducts();

    supabaseClient.auth.onAuthStateChange(() => {
      setTimeout(async () => {
        await refreshIdentity();
        await loadProducts();
      }, 0);
    });
  });
})();
