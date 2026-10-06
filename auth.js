// ==========================================
// ALTOFAN SOCIAL - AUTH
// تسجيل الدخول / إنشاء حساب / تسجيل الخروج
// ==========================================

async function signUp(email, password, fullName = "") {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error("Sign up error:", error);
    return { success: false, error: error.message };
  }

  if (data.user) {
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({
        id: data.user.id,
        full_name: fullName.trim(),
      });

    if (profileError) {
      console.error("Profile error:", profileError);
      return { success: false, error: profileError.message };
    }
  }

  return {
    success: true,
    user: data.user,
    session: data.session,
  };
}


// ==========================================
// تسجيل الدخول
// ==========================================

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error("Sign in error:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    user: data.user,
    session: data.session,
  };
}


// ==========================================
// تسجيل الخروج
// ==========================================

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}


// ==========================================
// الحصول على المستخدم الحالي
// ==========================================

async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    console.error("Get user error:", error);
    return null;
  }

  return user;
}


// ==========================================
// الحصول على بيانات البروفايل والصلاحية
// ==========================================

async function getMyProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, role, points_balance, referral_code")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Profile fetch error:", error);
    return null;
  }

  return data;
}


// ==========================================
// مراقبة حالة تسجيل الدخول
// ==========================================

supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);

  if (session?.user) {
    console.log("Logged in:", session.user.email);
  } else {
    console.log("No logged-in user");
  }
});

console.log("ALTOFAN AUTH: Supabase client loaded =", !!supabaseClient);
