import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CircleHelp, LogOut, Mail, ShieldCheck, Wallet, X } from 'lucide-react';
import styles from './App.module.css';
import InlineNotice from './components/InlineNotice.jsx';
import AdminWorkspace from './pages/Admin/AdminWorkspace.jsx';
import AuthDialog from './pages/Authentication/AuthDialog.jsx';
import PayoutPage from './pages/Payout/PayoutPage.jsx';
import HistoryPage from './pages/RedemptionHistory/HistoryPage.jsx';
import WalletDashboard from './pages/WalletDashboard/WalletDashboard.jsx';
import { METHODS } from './constants/methods.js';
import { api } from './services/api.js';
import { money } from './utils/formatters.js';

const EMPTY_OPTIONS = [];

function App() {
  const route = useLocation();
  const navigate = useNavigate();
  const queryMethod = new URLSearchParams(route.search).get('method');
  const methodKey = METHODS[queryMethod]
    ? queryMethod
    : queryMethod === 'google_play'
      ? 'googlePlay'
      : 'upi';
  const [token, setToken] = useState(() => sessionStorage.getItem('vl-token') || '');
  const [role, setRole] = useState(() => sessionStorage.getItem('vl-role') || '');
  const [identity, setIdentity] = useState(() =>
    JSON.parse(sessionStorage.getItem('vl-user') || 'null'),
  );
  const [config, setConfig] = useState({ methods: [], options: [] });
  const [configError, setConfigError] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [optionsResult, setOptionsResult] = useState({ key: '', options: [], error: '' });
  const [eligibilityQuotes, setEligibilityQuotes] = useState({});
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [loadedOptionsKey, setLoadedOptionsKey] = useState('');
  const optionsRequestKey = `${methodKey}:${optionsReloadKey}`;
  const activeMethod = config.methods.find((m) => m.methodKey === methodKey);
  const optionsLoading = !configLoaded
    ? true
    : activeMethod?.active === true && loadedOptionsKey !== optionsRequestKey;
  const options =
    activeMethod?.active === true && optionsResult.key === optionsRequestKey
      ? optionsResult.options
      : EMPTY_OPTIONS;
  const optionsError =
    configError ||
    (activeMethod?.active === true && optionsResult.key === optionsRequestKey
      ? optionsResult.error
      : '');
  const [balance, setBalance] = useState(null);
  const [totalWithdrawn, setTotalWithdrawn] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(() => Boolean(token && role === 'USER'));
  const [historyLoading, setHistoryLoading] = useState(() =>
    Boolean(token && role === 'USER' && ['/wallet', '/history'].includes(route.pathname)),
  );
  const [walletTab, setWalletTab] = useState('methods');
  const page = route.pathname.startsWith('/admin')
    ? 'admin'
    : route.pathname === '/wallet'
      ? 'wallet'
      : route.pathname === '/history'
        ? 'history'
        : 'payout';
  const [authMode, setAuthMode] = useState(route.pathname === '/admin/login' ? 'admin' : 'user');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [modal, setModal] = useState(
    route.pathname === '/admin/login'
      ? 'auth'
      : route.pathname === '/reset-password'
        ? 'reset'
        : null,
  );
  const modalRef = useRef(null);
  const modalReturnFocusRef = useRef(null);
  const resetToken =
    route.pathname === '/reset-password'
      ? new URLSearchParams(route.search).get('token') || ''
      : '';
  const [destination, setDestination] = useState('');
  const [quote, setQuote] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [requestDetails, setRequestDetails] = useState(null);
  const [adminData, setAdminData] = useState({
    dashboard: null,
    redemptions: [],
    redemptionTotal: 0,
    methods: [],
    options: [],
    users: [],
    userTotal: 0,
    transactions: [],
    transactionTotal: 0,
    logs: [],
  });
  const [adminLoading, setAdminLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [requestMethod, setRequestMethod] = useState('');
  const [requestSort, setRequestSort] = useState('newest');
  const [requestPage, setRequestPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [newOption, setNewOption] = useState({
    method: 'upi',
    displayName: '',
    denomination: '',
    requiredVEs: '',
    description: '',
    assetReference: '',
  });

  useEffect(() => {
    if (modal) {
      if (!modalReturnFocusRef.current) modalReturnFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        const firstControl =
          modalRef.current?.querySelector(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
          ) || modalRef.current;
        firstControl?.focus();
      });
      const keepFocusInDialog = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setModal(null);
          return;
        }
        if (event.key !== 'Tab' || !modalRef.current) return;
        const controls = [...modalRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )].filter((control) => control.getAttribute('aria-hidden') !== 'true');
        if (!controls.length) {
          event.preventDefault();
          modalRef.current.focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', keepFocusInDialog);
      return () => document.removeEventListener('keydown', keepFocusInDialog);
    }
    if (modalReturnFocusRef.current) {
      modalReturnFocusRef.current.focus?.();
      modalReturnFocusRef.current = null;
    }
    return undefined;
  }, [modal]);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api('/api/payout/config');
      setConfig({
        methods: Array.isArray(data.methods) ? data.methods : [],
        options: Array.isArray(data.options) ? data.options : [],
      });
      setConfigError('');
      setConfigLoaded(true);
    } catch (e) {
      setConfig({ methods: [], options: [] });
      setConfigError(e.message);
      setConfigLoaded(true);
    }
  }, []);
  const loadBalance = useCallback(async () => {
    if (!token || role !== 'USER') return;
    setBalanceLoading(true);
    try {
      const data = await api('/api/wallet', token);
      setBalance(data.wallet.availableBalance);
      setTotalWithdrawn(data.wallet.totalWithdrawn ?? null);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBalanceLoading(false);
    }
  }, [token, role]);
  useEffect(() => {
    let current = true;
    api('/api/payout/config')
      .then((data) => {
        if (current) {
          setConfig({
            methods: Array.isArray(data.methods) ? data.methods : [],
            options: Array.isArray(data.options) ? data.options : [],
          });
          setConfigError('');
          setConfigLoaded(true);
        }
      })
      .catch((e) => {
        if (current) {
          setConfig({ methods: [], options: [] });
          setConfigError(e.message);
          setConfigLoaded(true);
        }
      });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    if (!configLoaded || activeMethod?.active !== true) return undefined;
    let current = true;
    api(`/api/payout/options?method=${encodeURIComponent(methodKey)}`)
      .then((data) => {
        if (current) {
          setOptionsResult({
            key: optionsRequestKey,
            options: Array.isArray(data.options) ? data.options : [],
            error: '',
          });
        }
      })
      .catch((e) => {
        if (!current) return;
        if (e.code !== 'METHOD_UNAVAILABLE') {
          setOptionsResult({ key: optionsRequestKey, options: [], error: e.message });
        } else {
          setOptionsResult({ key: optionsRequestKey, options: [], error: '' });
        }
      })
      .finally(() => {
        if (current) setLoadedOptionsKey(optionsRequestKey);
      });
    return () => {
      current = false;
    };
  }, [activeMethod?.active, configLoaded, methodKey, optionsReloadKey, optionsRequestKey]);
  useEffect(() => {
    if (!token || role !== 'USER' || !options.length) return undefined;
    let current = true;
    Promise.allSettled(
      options.map(async (option) => {
        const quote = await api('/api/redemptions/quote', token, {
          method: 'POST',
          body: JSON.stringify({ method: methodKey, rewardOptionId: option._id }),
        });
        return [option._id, quote];
      }),
    ).then((results) => {
      if (!current) return;
      const next = {};
      results.forEach((result, index) => {
        const id = options[index]._id;
        next[id] = result.status === 'fulfilled'
          ? { loading: false, error: '', quote: result.value[1] }
          : { loading: false, error: result.reason?.message || 'Could not verify eligibility.', quote: null };
      });
      setEligibilityQuotes(next);
    });
    return () => {
      current = false;
    };
  }, [methodKey, options, role, token]);
  useEffect(() => {
    if (!token || role !== 'USER') return undefined;
    let current = true;
    api('/api/wallet', token)
      .then((data) => {
        if (current) {
          setBalance(data.wallet.availableBalance);
          setTotalWithdrawn(data.wallet.totalWithdrawn ?? null);
        }
      })
      .catch((e) => {
        if (current) setNotice(e.message);
      })
      .finally(() => {
        if (current) setBalanceLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token, role]);
  useEffect(() => {
    if ((page === 'history' || page === 'wallet') && token && role === 'USER') {
      let current = true;
      api('/api/redemptions/my-history', token)
        .then((data) => {
          if (current) setHistoryRows(data.redemptions);
        })
        .catch((e) => {
          if (current) setNotice(e.message);
        })
        .finally(() => {
          if (current) setHistoryLoading(false);
        });
      return () => {
        current = false;
      };
    }
  }, [page, token, role]);

  const selectedMethod = METHODS[methodKey];
  const selectedMethodName = activeMethod?.displayName || selectedMethod.name;
  const retryPayoutOptions = () => {
    setEligibilityQuotes({});
    loadConfig();
    setOptionsReloadKey((current) => current + 1);
  };
  const refreshPayout = () => {
    loadBalance();
    retryPayoutOptions();
  };
  const refreshWallet = async () => {
    await loadBalance();
    if (!token || role !== 'USER') return;
    setHistoryLoading(true);
    try {
      const data = await api('/api/redemptions/my-history', token);
      setHistoryRows(data.redemptions);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };
  const updateRoute = (nextPage, method = methodKey) => {
    if (nextPage === 'wallet' || nextPage === 'history') setHistoryLoading(true);
    if (nextPage === 'admin') setAdminLoading(true);
    const path =
      nextPage === 'admin'
        ? '/admin/dashboard'
        : nextPage === 'wallet'
          ? '/wallet'
          : nextPage === 'history'
            ? '/history'
            : `/Payout?method=${encodeURIComponent(method)}`;
    navigate(path);
  };
  const saveSession = (newToken, newRole, who) => {
    sessionStorage.setItem('vl-token', newToken);
    sessionStorage.setItem('vl-role', newRole);
    sessionStorage.setItem('vl-user', JSON.stringify(who));
    setToken(newToken);
    setRole(newRole);
    setIdentity(who);
    setEligibilityQuotes({});
    if (newRole === 'USER') {
      setBalance(null);
      setTotalWithdrawn(null);
      setBalanceLoading(true);
      setHistoryLoading(true);
    } else if (newRole === 'ADMIN') {
      setAdminLoading(true);
    }
    setNotice('');
  };
  const signOut = async () => {
    try {
      if (token)
        await api(role === 'ADMIN' ? '/api/admin/auth/logout' : '/api/auth/logout', token, {
          method: 'POST',
        });
    } catch {
      /* Local sign-out still clears this browser session. */
    } finally {
      sessionStorage.clear();
      setToken('');
      setRole('');
      setIdentity(null);
      setEligibilityQuotes({});
      setBalance(null);
      setTotalWithdrawn(null);
      setBalanceLoading(false);
      setHistoryLoading(false);
      navigate('/Payout?method=upi');
      setNotice('You have been signed out.');
    }
  };
  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const path = authMode === 'admin' ? '/api/admin/auth/login' : '/api/auth/login';
      const data = await api(path, '', {
        method: 'POST',
        body: JSON.stringify({ email: authForm.email, password: authForm.password }),
      });
      const who = data.user || data.admin;
      const authenticatedRole = authMode === 'admin' ? 'ADMIN' : 'USER';
      saveSession(data.token, authenticatedRole, who);
      setAuthForm((current) => ({ ...current, password: '' }));
      setModal(null);
      updateRoute(authMode === 'admin' ? 'admin' : 'wallet');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const requestPasswordReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const result = await api('/api/auth/forgot-password', '', {
        method: 'POST',
        body: JSON.stringify({ email: authForm.email }),
      });
      setModal('reset-sent');
      setNotice(result.message);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const resetPassword = async (event) => {
    event.preventDefault();
    if (authForm.password.length < 10) {
      setNotice('Choose a password with at least 10 characters.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const result = await api('/api/auth/reset-password', '', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password: authForm.password }),
      });
      setAuthForm({ name: '', email: authForm.email, password: '' });
      setModal('auth');
      navigate(`/Payout?method=${encodeURIComponent(methodKey)}`);
      setNotice(result.message);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const register = async (event) => {
    event.preventDefault();
    if (authForm.password.length < 10) {
      setNotice('Choose a password with at least 10 characters.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const data = await api('/api/auth/register', '', {
        method: 'POST',
        body: JSON.stringify(authForm),
      });
      saveSession(data.token, 'USER', data.user);
      setAuthForm({ name: '', email: data.user.email, password: '' });
      setModal(null);
      updateRoute('wallet');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const chooseMethod = (key) => {
    setEligibilityQuotes({});
    navigate(`/Payout?method=${key}`);
    setQuote(null);
    setModal(null);
    setNotice('');
  };
  const startRedemption = async (reward) => {
    if (!token) {
      setNotice('Sign in to check your balance and redeem rewards.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const data = await api('/api/redemptions/quote', token, {
        method: 'POST',
        body: JSON.stringify({ method: methodKey, rewardOptionId: reward._id }),
      });
      if (!data.eligible) {
        setNotice(`You need ${data.shortfall.toLocaleString('en-IN')} more VEs to unlock this reward.`);
        setBalance(data.availableBalance);
        return;
      }
      setQuote({ ...data, reward: { ...reward, ...data.reward } });
      setDestination('');
      setModal('details');
    } catch (e) {
      setNotice(e.message);
      if (['METHOD_UNAVAILABLE', 'OPTION_UNAVAILABLE'].includes(e.code)) retryPayoutOptions();
    } finally {
      setBusy(false);
    }
  };
  const toReview = (event) => {
    event.preventDefault();
    const value = destination.trim();
    if (!value) {
      setNotice(
        methodKey === 'upi'
          ? 'Enter your UPI ID to continue.'
          : 'Enter your delivery email to continue.',
      );
      return;
    }
    if (
      methodKey === 'upi'
        ? !/^[\w.-]{2,256}@[\w]{2,64}$/.test(value)
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      setNotice(
        methodKey === 'upi' ? 'Check the format of your UPI ID.' : 'Enter a valid email address.',
      );
      return;
    }
    setNotice('');
    setModal('review');
  };
  const confirmRedemption = async () => {
    if (!quote) return;
    setBusy(true);
    setNotice('');
    const idempotencyKey = crypto.randomUUID();
    const dest =
      methodKey === 'upi' ? { upiId: destination.trim() } : { email: destination.trim() };
    try {
      const data = await api('/api/redemptions', token, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          method: methodKey,
          rewardOptionId: quote.reward._id,
          destination: dest,
        }),
      });
      setBalance(data.wallet.availableBalance);
      setModal('success');
      setQuote(data.redemption);
      setDestination('');
    } catch (e) {
      const message = e.code === 'INSUFFICIENT_BALANCE'
        ? 'Your available balance changed. We refreshed it; review this reward again before submitting.'
        : e.code === 'DUPLICATE_SUBMISSION'
          ? 'This redemption was already submitted. Check your redemption history for its latest status.'
          : e.message;
      setNotice(message);
      setModal(null);
      await loadBalance();
      if (['METHOD_UNAVAILABLE', 'OPTION_UNAVAILABLE'].includes(e.code)) {
        retryPayoutOptions();
      }
    } finally {
      setBusy(false);
    }
  };
  const loadHistory = async () => {
    try {
      const data = await api('/api/redemptions/my-history', token);
      setHistoryRows(data.redemptions);
      updateRoute('history');
    } catch (e) {
      setNotice(e.message);
    }
  };
  const fetchAdminData = useCallback(async () => {
    if (role !== 'ADMIN') return null;
      const requestQuery = new URLSearchParams({
        page: String(requestPage),
        limit: '20',
        sort: requestSort,
      });
      if (requestSearch) requestQuery.set('search', requestSearch);
      if (requestStatus) requestQuery.set('status', requestStatus);
      if (requestMethod) requestQuery.set('method', requestMethod);
      if (reportFrom) requestQuery.set('dateFrom', reportFrom);
      if (reportTo) requestQuery.set('dateTo', reportTo);
      const userQuery = new URLSearchParams({ search: userSearch, page: String(userPage), limit: '20' });
      const transactionQuery = new URLSearchParams({ page: String(transactionPage), limit: '20' });
      const dashboardQuery = new URLSearchParams();
      if (reportFrom) dashboardQuery.set('dateFrom', reportFrom);
      if (reportTo) dashboardQuery.set('dateTo', reportTo);
      const [dashboard, requests, methods, options, users, transactions, audit] = await Promise.all(
        [
          api(`/api/admin/dashboard?${dashboardQuery}`, token),
          api(`/api/admin/redemptions?${requestQuery}`, token),
          api('/api/admin/payout-methods', token),
          api('/api/admin/reward-options', token),
          api(`/api/admin/users?${userQuery}`, token),
          api(`/api/admin/transactions?${transactionQuery}`, token),
          api('/api/admin/audit-logs?limit=20', token),
        ],
      );
      return {
        dashboard,
        redemptions: requests.redemptions,
        redemptionTotal: requests.total,
        methods: methods.methods,
        options: options.options,
        users: users.users,
        userTotal: users.total,
        transactions: transactions.transactions,
        transactionTotal: transactions.total,
        logs: audit.logs,
      };
  }, [
    role,
    token,
    userSearch,
    userPage,
    requestSearch,
    requestStatus,
    requestMethod,
    requestSort,
    requestPage,
    transactionPage,
    reportFrom,
    reportTo,
  ]);
  const loadAdmin = useCallback(async () => {
    setAdminLoading(true);
    try {
      const data = await fetchAdminData();
      if (data) setAdminData(data);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setAdminLoading(false);
    }
  }, [fetchAdminData]);
  useEffect(() => {
    if (page !== 'admin' || !token || role !== 'ADMIN') return undefined;
    let current = true;
    fetchAdminData()
      .then((data) => {
        if (current && data) setAdminData(data);
      })
      .catch((e) => {
        if (current) setNotice(e.message);
      })
      .finally(() => {
        if (current) setAdminLoading(false);
      });
    return () => {
      current = false;
    };
  }, [page, token, role, fetchAdminData]);
  const updateRequest = async (id, status, reason, providerReference = '') => {
    try {
      const result = await api(`/api/admin/redemptions/${id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, ...(providerReference ? { providerReference } : {}) }),
      });
      await loadAdmin();
      if (requestDetails?._id === id) setRequestDetails(result.redemption);
      setNotice(`${result.redemption.referenceId} is now ${result.redemption.status.replaceAll('_', ' ')}.`);
      return result.redemption;
    } catch (e) {
      setNotice(e.message);
      throw e;
    }
  };
  const openRequest = async (id) => {
    try {
      const data = await api(`/api/admin/redemptions/${id}`, token);
      setRequestDetails(data.redemption);
    } catch (e) {
      setNotice(e.message);
    }
  };
  const openUser = async (id) => {
    try {
      const data = await api(`/api/admin/users/${id}`, token);
      setUserDetails(data);
    } catch (e) {
      setNotice(e.message);
    }
  };
  const updateUserAccess = async (user, reason) => {
    const active = !user.active;
    try {
      const result = await api(`/api/admin/users/${user._id}/access`, token, {
        method: 'PATCH',
        body: JSON.stringify({ active, reason: reason.trim() }),
      });
      await loadAdmin();
      if (userDetails?.user?._id === user._id) await openUser(user._id);
      setNotice(`Payout access ${result.user.active ? 'restored' : 'suspended'} for ${result.user.email}.`);
      return result.user;
    } catch (e) {
      setNotice(e.message);
      throw e;
    }
  };
  const updateMethod = async (item, changes, reason = '', rethrow = false) => {
    try {
      const result = await api(`/api/admin/payout-methods/${item._id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ ...changes, ...(reason ? { reason } : {}) }),
      });
      await loadAdmin();
      await loadConfig();
      if (changes.active !== undefined) {
        setNotice(`${result.method.displayName} is now ${result.method.active ? 'available' : 'disabled'}.`);
      }
      return result.method;
    } catch (e) {
      setNotice(e.message);
      if (rethrow) throw e;
    }
  };
  const createOption = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...newOption,
        denomination: Number(newOption.denomination),
        requiredVEs: Number(newOption.requiredVEs),
        active: false,
      };
      await api('/api/admin/reward-options', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNewOption({
        method: 'upi',
        displayName: '',
        denomination: '',
        requiredVEs: '',
        description: '',
        assetReference: '',
      });
      await loadAdmin();
      setNotice('Option saved inactive. Verify the approved amounts before enabling it.');
    } catch (e) {
      setNotice(e.message);
    }
  };
  const toggleOption = async (item, changes = null, reason = '') => {
    const update = {
      method: item.method,
      displayName: item.displayName,
      denomination: item.denomination,
      currency: item.currency,
      requiredVEs: item.requiredVEs,
      description: item.description,
      assetReference: item.assetReference || '',
      active: changes?.active ?? item.active,
      sortOrder: item.sortOrder,
      ...changes,
    };
    try {
      const result = await api(`/api/admin/reward-options/${item._id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ ...update, ...(reason ? { reason } : {}) }),
      });
      await loadAdmin();
      await loadConfig();
      if (changes?.active !== undefined) {
        setNotice(`${result.option.displayName} is now ${result.option.active ? 'available' : 'disabled'}.`);
      } else if (changes?.requiredVEs !== undefined || changes?.denomination !== undefined) {
        setNotice(`Updated ${result.option.displayName}: ${result.option.requiredVEs.toLocaleString('en-IN')} VEs required.`);
      }
      return result.option;
    } catch (e) {
      setNotice(e.message);
      throw e;
    }
  };

  return (
    <div className={`${styles.appShell} ${page === 'wallet' ? styles.walletShell : ''}`}>
      <header className={styles.topbar}>
        <a
          className={styles.brand}
          href="/Payout?method=upi"
          onClick={(e) => {
            e.preventDefault();
            updateRoute('payout');
          }}
        >
          <span className={styles.brandMark}>
            <span>V</span>
          </span>
          <span>
            VE<span className={styles.brandAccent}>LOOP</span>
            <small>PAYOUT SYSTEM</small>
          </span>
        </a>
        <nav className={styles.navLinks}>
          {token && role === 'USER' && (
            <button
              className={page === 'wallet' ? styles.navActive : ''}
              onClick={() => updateRoute('wallet')}
            >
              Wallet
            </button>
          )}
          <button
            className={page === 'payout' ? styles.navActive : ''}
            onClick={() => updateRoute('payout')}
          >
            Redeem
          </button>
          {token && role === 'USER' && <button onClick={loadHistory}>History</button>}
          {token && role === 'ADMIN' && (
            <button onClick={() => updateRoute('admin')}>Admin workspace</button>
          )}
        </nav>
        <div className={styles.topActions}>
          {token ? (
            <>
              <span className={styles.userBadge}>
                <span className={styles.onlineDot} />
                {identity?.name || identity?.email || 'Account'}
              </span>
              <button className={styles.iconButton} aria-label="Sign out" onClick={signOut}>
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.signInButton}
                onClick={() => {
                  setAuthMode('user');
                  setModal('auth');
                }}
              >
                Sign in
              </button>
              <button
                className={styles.primarySmall}
                onClick={() => {
                  setAuthMode('user');
                  setModal('register');
                }}
              >
                Get started <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <InlineNotice styles={styles} message={notice} onDismiss={() => setNotice('')} />
        {!configLoaded && (
          <div className={styles.initialLoader} role="status" aria-live="polite">
            <span className={styles.spinIcon} />
            <span>Loading VELOOP Rewards…</span>
          </div>
        )}
        {page === 'payout' && configLoaded && (
          <PayoutPage
            styles={styles}
            token={token}
            balance={balance}
            balanceLoading={balanceLoading}
            configLoaded={configLoaded}
            totalWithdrawn={totalWithdrawn}
            selectedMethod={selectedMethod}
            methodKey={methodKey}
            config={config}
            activeMethod={activeMethod}
            options={options}
            eligibilityQuotes={eligibilityQuotes}
            optionsLoading={optionsLoading}
            optionsError={optionsError || configError}
            retryOptions={retryPayoutOptions}
            refreshPayout={refreshPayout}
            busy={busy}
            chooseMethod={chooseMethod}
            setNotice={setNotice}
            startRedemption={startRedemption}
          />
        )}
        {page === 'wallet' && configLoaded && token && role === 'USER' && (
          <WalletDashboard
            identity={identity}
            balance={balance}
            totalWithdrawn={totalWithdrawn}
            balanceLoading={balanceLoading}
            historyLoading={historyLoading}
            methods={config.methods}
            options={config.options}
            rows={historyRows}
            tab={walletTab}
            setTab={setWalletTab}
            refresh={refreshWallet}
            onWithdraw={chooseMethod}
          />
        )}
        {page === 'wallet' && configLoaded && (!token || role !== 'USER') && (
          <div className={styles.emptyRewards}>
            <Wallet size={28} />
            <h2>Sign in to view your wallet</h2>
            <p>Your balance and withdrawal activity are private to your VELOOP account.</p>
            <button
              className={styles.primarySmall}
              onClick={() => {
                setAuthMode('user');
                setModal('auth');
              }}
            >
              Sign in <ArrowRight size={14} />
            </button>
          </div>
        )}
        {page === 'history' && token && role === 'USER' && configLoaded && (
          <HistoryPage
            styles={styles}
            rows={historyRows}
            loading={historyLoading}
            refresh={loadHistory}
            onRedeem={() => updateRoute('payout')}
          />
        )}
        {page === 'history' && configLoaded && (!token || role !== 'USER') && (
          <div className={styles.emptyRewards}>
            <h2>Sign in to view your redemption history</h2>
            <p>Your account history is private. Sign in with your VELOOP account to continue.</p>
            <button
              className={styles.primarySmall}
              onClick={() => {
                setAuthMode('user');
                setModal('auth');
              }}
            >
              Sign in
            </button>
          </div>
        )}
        {page === 'admin' && configLoaded && token && role === 'ADMIN' && (
          <AdminWorkspace
            styles={styles}
            data={adminData}
            loading={adminLoading}
            refresh={loadAdmin}
            updateRequest={updateRequest}
            updateMethod={updateMethod}
            newOption={newOption}
            setNewOption={setNewOption}
            createOption={createOption}
            toggleOption={toggleOption}
            openRequest={openRequest}
            requestDetails={requestDetails}
            closeRequest={() => setRequestDetails(null)}
            userSearch={userSearch}
            setUserSearch={(value) => {
              setUserSearch(value);
              setUserPage(1);
            }}
            requestSearch={requestSearch}
            setRequestSearch={(value) => {
              setRequestSearch(value);
              setRequestPage(1);
            }}
            requestStatus={requestStatus}
            setRequestStatus={(value) => {
              setRequestStatus(value);
              setRequestPage(1);
            }}
            requestMethod={requestMethod}
            setRequestMethod={(value) => {
              setRequestMethod(value);
              setRequestPage(1);
            }}
            requestSort={requestSort}
            setRequestSort={setRequestSort}
            requestPage={requestPage}
            setRequestPage={setRequestPage}
            userPage={userPage}
            setUserPage={setUserPage}
            transactionPage={transactionPage}
            setTransactionPage={setTransactionPage}
            reportFrom={reportFrom}
            setReportFrom={(value) => {
              setReportFrom(value);
              setRequestPage(1);
            }}
            reportTo={reportTo}
            setReportTo={(value) => {
              setReportTo(value);
              setRequestPage(1);
            }}
            openUser={openUser}
            userDetails={userDetails}
            closeUser={() => setUserDetails(null)}
            updateUserAccess={updateUserAccess}
          />
        )}
        {page === 'admin' && configLoaded && (!token || role !== 'ADMIN') && (
          <div className={styles.emptyRewards}>
            <ShieldCheck size={28} />
            <h3>Admin sign in required</h3>
            <button
              className={styles.primarySmall}
              onClick={() => {
                setAuthMode('admin');
                setModal('auth');
              }}
            >
              Go to admin login <ArrowRight size={14} />
            </button>
          </div>
        )}
        <footer className={styles.footer}>
          <span>© 2026 VELOOP Rewards</span>
          <span>
            <ShieldCheck size={14} /> Built around secure, transparent redemption
          </span>
          <button
            onClick={() => {
              setAuthMode('admin');
              setModal('auth');
            }}
          >
            Admin access
          </button>
        </footer>
      </main>

      {modal && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={`${styles.modal} ${modal === 'success' ? styles.successModal : ''}`}
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button className={styles.modalClose} onClick={() => setModal(null)} aria-label="Close">
              <X size={18} />
            </button>
            {modal === 'auth' ||
            modal === 'register' ||
            modal === 'forgot' ||
            modal === 'reset-sent' ||
            modal === 'reset' ? (
              <AuthDialog
                styles={styles}
                mode={modal}
                authMode={authMode}
                authForm={authForm}
                setAuthForm={setAuthForm}
                busy={busy}
                setModal={setModal}
                signIn={signIn}
                register={register}
                requestPasswordReset={requestPasswordReset}
                resetPassword={resetPassword}
              />
            ) : null}
            {modal === 'details' && quote && (
              <>
                <span className={styles.modalEyebrow}>STEP 02 / DESTINATION</span>
                <h2 id="modal-title">Where should we send it?</h2>
                <p>Enter the destination for your {quote.reward.displayName} redemption.</p>
                <div className={styles.modalSummary}>
                  <span>{selectedMethodName} · {quote.reward.displayName}</span>
                  <b>{quote.reward.requiredVEs.toLocaleString('en-IN')} VEs</b>
                </div>
                <form className={styles.form} onSubmit={toReview}>
                  <label>
                    {methodKey === 'upi' ? 'UPI ID' : 'Delivery email'}
                    <div className={styles.inputIcon}>
                      {methodKey === 'upi' ? <Wallet size={17} /> : <Mail size={17} />}
                      <input
                        autoFocus
                        required
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder={methodKey === 'upi' ? 'name@bank' : 'you@example.com'}
                        type={methodKey === 'upi' ? 'text' : 'email'}
                        autoComplete={methodKey === 'upi' ? 'off' : 'email'}
                      />
                    </div>
                    <small>
                      {methodKey === 'upi'
                        ? 'We check the format; the UPI ID is not verified until payout processing.'
                        : 'Double-check this address before continuing.'}
                    </small>
                  </label>
                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className={styles.outlineButton}
                      onClick={() => setModal(null)}
                    >
                      Cancel
                    </button>
                    <button className={styles.redeemButton}>
                      Review <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal === 'review' && quote && (
              <>
                <span className={styles.modalEyebrow}>STEP 03 / FINAL REVIEW</span>
                <h2 id="modal-title">Confirm redemption</h2>
                <p>
                  Please verify the reward and destination. This will submit a request for review.
                </p>
                <div className={styles.reviewBox}>
                  <div>
                    <span>METHOD</span>
                    <b>{selectedMethodName}</b>
                  </div>
                  <div>
                    <span>REWARD</span>
                    <b>
                      {quote.reward.displayName} ·{' '}
                      {money(quote.reward.denomination, quote.reward.currency)}
                    </b>
                  </div>
                  <div>
                    <span>VE COST</span>
                    <b>{quote.reward.requiredVEs.toLocaleString('en-IN')} VEs</b>
                  </div>
                  <div>
                    <span>AVAILABLE</span>
                    <b>{quote.availableBalance.toLocaleString('en-IN')} VEs</b>
                  </div>
                  <div>
                    <span>EST. REMAINING</span>
                    <b>{quote.remainingBalance.toLocaleString('en-IN')} VEs</b>
                  </div>
                  <div>
                    <span>{methodKey === 'upi' ? 'UPI ID' : 'DELIVERY EMAIL'}</span>
                    <b className={styles.destinationValue}>{destination}</b>
                  </div>
                </div>
                <div className={styles.warning}>
                  <CircleHelp size={17} />
                  <span>
                    Confirming creates a real request and deducts the VE cost from your available
                    wallet balance. The administrator will review it.
                  </span>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.outlineButton} onClick={() => setModal('details')}>
                    Back
                  </button>
                  <button
                    className={styles.redeemButton}
                    disabled={busy}
                    onClick={confirmRedemption}
                  >
                    {busy ? 'Submitting…' : 'Confirm redemption'} <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {modal === 'success' && quote && (
              <>
                <div className={styles.successMark}>
                  <Check size={28} />
                </div>
                <span className={styles.modalEyebrow}>REQUEST RECEIVED</span>
                <h2 id="modal-title">Redemption submitted</h2>
                <p>
                  Your request has been saved. You can check its progress in your redemption
                  history.
                </p>
                <div className={styles.successRef}>
                  <span>REFERENCE</span>
                  <b>{quote.referenceId}</b>
                </div>
                <div className={styles.reviewBox}>
                  <div>
                    <span>STATUS</span>
                    <b>
                      <span className={`${styles.status} ${styles[`status_${quote.status}`] || ''}`}>
                        {quote.status?.replaceAll('_', ' ') || 'Submitted'}
                      </span>
                    </b>
                  </div>
                  <div>
                    <span>METHOD</span>
                    <b>{config.methods.find((method) => method.methodKey === quote.method)?.displayName || METHODS[quote.method]?.name}</b>
                  </div>
                  <div>
                    <span>REWARD</span>
                    <b>{quote.rewardSnapshot?.displayName}</b>
                  </div>
                  {quote.submittedAt && (
                    <div>
                      <span>SUBMITTED</span>
                      <b>{new Date(quote.submittedAt).toLocaleString()}</b>
                    </div>
                  )}
                </div>
                <button
                  className={styles.redeemButton}
                  onClick={() => {
                    setModal(null);
                    loadHistory();
                  }}
                >
                  View redemption history <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
