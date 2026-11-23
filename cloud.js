/* cloud.js — login (Supabase Auth) + sincronização do estado na nuvem.
   O app continua funcionando offline (localStorage); quando há login e internet,
   sincroniza o estado inteiro (jsonb) na tabela app_state (uma linha por usuário, protegida por RLS). */
'use strict';
(function(){
  let supa=null, _user=null, pushTimer=null;

  window.cloudEnabled = function(){
    return !!(window.SUPA_URL && window.SUPA_ANON && window.supabase && window.supabase.createClient);
  };
  window.initCloud = function(){
    if(!window.cloudEnabled()) return null;
    try{
      supa = window.supabase.createClient(window.SUPA_URL, window.SUPA_ANON,
        { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
      return supa;
    }catch(e){ console.warn('initCloud', e); return null; }
  };

  window.setCloudUser   = function(u){ _user = u || null; };
  window.cloudUserEmail = function(){ return _user ? (_user.email||'') : ''; };
  window.cloudLoggedIn  = function(){ return !!_user; };

  window.cloudGetSession = async function(){
    if(!supa) return null;
    try{ const { data } = await supa.auth.getSession(); return data.session || null; }catch(e){ return null; }
  };
  window.onCloudAuth = function(cb){
    if(!supa) return;
    supa.auth.onAuthStateChange((event, session)=>{ _user = session ? session.user : null; cb(event, session); });
  };

  window.cloudSignUp = async function(email,pass){ if(!supa) return {error:{message:'cloud off'}}; return supa.auth.signUp({ email:email.trim(), password:pass }); };
  window.cloudSignIn = async function(email,pass){ if(!supa) return {error:{message:'cloud off'}}; return supa.auth.signInWithPassword({ email:email.trim(), password:pass }); };
  window.cloudReset  = async function(email){ if(!supa) return {}; try{ return await supa.auth.resetPasswordForEmail(email.trim()); }catch(e){ return {error:e}; } };
  window.cloudSignOut= async function(){ if(supa){ try{ await supa.auth.signOut(); }catch(e){} } _user=null; };

  window.cloudPull = async function(){
    if(!supa || !_user) return { status:'noauth' };
    try{
      const { data, error } = await supa.from('app_state').select('data,updated_at').eq('user_id', _user.id).maybeSingle();
      if(error) return { status:'error', error };
      if(!data)  return { status:'none' };
      return { status:'ok', row:data };
    }catch(e){ return { status:'error', error:e }; }
  };
  window.cloudPush = async function(state){
    if(!supa || !_user) return;
    try{
      const payload = { user_id:_user.id, data:state, updated_at:new Date().toISOString() };
      const { error } = await supa.from('app_state').upsert(payload, { onConflict:'user_id' });
      if(error) console.warn('cloudPush', error);
    }catch(e){ console.warn('cloudPush', e); }
  };
  window.schedulePush = function(state){
    if(!supa || !_user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(()=>{ window.cloudPush(state); }, 1500);
  };
})();
