import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, UserRound } from 'lucide-react';
import { METHODS } from '../../constants/methods.js';
import { money } from '../../utils/formatters.js';

export default function AdminWorkspace({
  styles: s,
  data,
  loading,
  refresh,
  updateRequest,
  updateMethod,
  newOption,
  setNewOption,
  createOption,
  toggleOption,
  openRequest,
  requestDetails,
  closeRequest,
  userSearch,
  setUserSearch,
  requestSearch,
  setRequestSearch,
  requestStatus,
  setRequestStatus,
  requestMethod,
  setRequestMethod,
  requestSort,
  setRequestSort,
  requestPage,
  setRequestPage,
  userPage,
  setUserPage,
  transactionPage,
  setTransactionPage,
  reportFrom,
  setReportFrom,
  reportTo,
  setReportTo,
  openUser,
  userDetails,
  closeUser,
  updateUserAccess,
}) {
  const stats = data.dashboard?.statusCounts || {};
  const [methodDrafts, setMethodDrafts] = useState({});
  const [optionDrafts, setOptionDrafts] = useState({});
  const [pendingAction, setPendingAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [providerReference, setProviderReference] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const actionBusyRef = useRef(false);
  const actionDialogRef = useRef(null);
  const actionReturnFocusRef = useRef(null);
  const pageCount = (total) => Math.max(1, Math.ceil((total || 0) / 20));
  const updateDraft = (setter, id, current, key, value) =>
    setter((drafts) => ({ ...drafts, [id]: { ...current, [key]: value } }));
  const confirmAction = (action) => {
    actionReturnFocusRef.current = document.activeElement;
    setPendingAction(action);
    setActionReason('');
    setProviderReference('');
    setActionError('');
  };
  useEffect(() => {
    actionBusyRef.current = actionBusy;
  }, [actionBusy]);
  useEffect(() => {
    if (pendingAction) {
      const dialog = actionDialogRef.current;
      (dialog?.querySelector('textarea, input, button') || dialog)?.focus();
      const handleDialogKeys = (event) => {
        if (event.key === 'Escape' && !actionBusyRef.current) {
          event.preventDefault();
          setPendingAction(null);
        }
        if (event.key !== 'Tab' || !dialog) return;
        const controls = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')];
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) return;
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', handleDialogKeys);
      return () => document.removeEventListener('keydown', handleDialogKeys);
    }
    actionReturnFocusRef.current?.focus?.();
    actionReturnFocusRef.current = null;
    return undefined;
  }, [pendingAction]);
  const submitAction = async (event) => {
    event.preventDefault();
    if (!pendingAction) return;
    if (pendingAction.requireReason && actionReason.trim().length < 3) {
      setActionError('Enter a reason of at least 3 characters.');
      return;
    }
    setActionBusy(true);
    setActionError('');
    try {
      await pendingAction.run(actionReason.trim(), providerReference.trim());
      setPendingAction(null);
    } catch (error) {
      setActionError(error.message || 'The action could not be completed.');
    } finally {
      setActionBusy(false);
    }
  };
  const payoutSummary = (data.dashboard?.requestedPayoutValues || [])
    .map(({ currency, total }) => money(total, currency))
    .join(' / ') || '—';
  return (
    <section className={s.contentSection}>
      <div className={s.sectionHeading}>
        <div>
          <span className={s.sectionKicker}>OPERATIONS / SUPER ADMIN</span>
          <h2>Admin workspace</h2>
          <p>Review live redemption activity and manage verified reward configuration.</p>
        </div>
        <button className={s.outlineButton} onClick={refresh}>
          <RefreshCw size={15} /> Refresh data
        </button>
      </div>
      <nav className={s.adminNav} aria-label="Admin workspace sections">
        <a href="#admin-overview">Overview</a>
        <a href="#admin-redemptions">Redemptions</a>
        <a href="#admin-methods">Payout methods</a>
        <a href="#admin-options">Reward options</a>
        <a href="#admin-users">Users</a>
        <a href="#admin-transactions">Transactions</a>
        <a href="#admin-audit">Audit logs</a>
      </nav>
      <div className={s.adminFilters}>
        <label>
          From
          <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
        </label>
      </div>
      <div className={s.adminStats} id="admin-overview">
        {[
          ['Total requests', Object.values(stats).reduce((a, b) => a + b, 0)],
          ['Pending', stats.PENDING || 0],
          ['Under review', stats.UNDER_REVIEW || 0],
          ['Approved', stats.APPROVED || 0],
          ['Completed', stats.COMPLETED || 0],
          ['Rejected', stats.REJECTED || 0],
          ['Cancelled', stats.CANCELLED || 0],
          ['Failed', stats.FAILED || 0],
          ['VE requested', (data.dashboard?.requestedVEs || 0).toLocaleString('en-IN')],
          ['Net VE deducted', (data.dashboard?.netDeductedVEs || 0).toLocaleString('en-IN')],
          ['Requested payout value', payoutSummary],
          ['Active methods', data.dashboard?.activeMethods || 0],
          ['Active options', data.dashboard?.activeOptions || 0],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </article>
        ))}
      </div>
      <div className={s.adminBlock}>
        <div className={s.adminBlockHead}><div><h3>Recent activity</h3><p>Latest requests in the selected date range.</p></div></div>
        {data.dashboard?.recent?.length ? (
          <div className={s.recentActivity}>
            {data.dashboard.recent.map((row) => (
              <button key={row._id} onClick={() => openRequest(row._id)}>
                <span><b>{row.referenceId}</b><small>{row.rewardSnapshot?.displayName} · {row.method}</small></span>
                <span><b>{row.status.replaceAll('_', ' ')}</b><small>{new Date(row.createdAt).toLocaleString()}</small></span>
              </button>
            ))}
          </div>
        ) : <div className={s.tableEmpty}>No requests in this date range.</div>}
      </div>
      {requestDetails && (
        <div className={s.adminBlock} id="admin-request-detail">
          <div className={s.adminBlockHead}>
            <div>
              <h3>Request · {requestDetails.referenceId}</h3>
              <p>Destination is visible only in this authenticated admin detail view.</p>
            </div>
            <button className={s.outlineButton} onClick={closeRequest}>
              Close
            </button>
          </div>
          <div className={s.reviewBox}>
            <div>
              <span>INTERNAL REQUEST ID</span>
              <b>{requestDetails._id}</b>
            </div>
            <div>
              <span>PUBLIC REFERENCE</span>
              <b>{requestDetails.referenceId}</b>
            </div>
            <div>
              <span>REWARD OPTION ID</span>
              <b>{requestDetails.rewardOptionId}</b>
            </div>
            <div>
              <span>USER ID</span>
              <b>{requestDetails.userId}</b>
            </div>
            <div>
              <span>METHOD</span>
              <b>{METHODS[requestDetails.method]?.name}</b>
            </div>
            <div>
              <span>REWARD</span>
              <b>
                {requestDetails.rewardSnapshot?.displayName} ·{' '}
                {money(
                  requestDetails.rewardSnapshot?.denomination,
                  requestDetails.rewardSnapshot?.currency,
                )}
              </b>
            </div>
            <div>
              <span>VE COST</span>
              <b>{requestDetails.requiredVEs?.toLocaleString('en-IN')} VEs</b>
            </div>
            <div>
              <span>SUBMITTED</span>
              <b>{requestDetails.createdAt ? new Date(requestDetails.createdAt).toLocaleString() : '—'}</b>
            </div>
            {requestDetails.transactions?.length ? requestDetails.transactions.map((transaction) => (
              <div key={transaction._id}>
                <span>WALLET TRANSACTION · {transaction.type}</span>
                <b>
                  {transaction.transactionId} · {transaction.currency} {transaction.amount.toLocaleString('en-IN')} · {transaction.balanceBefore?.toLocaleString('en-IN')} → {transaction.balanceAfter?.toLocaleString('en-IN')} · {transaction.status}
                </b>
              </div>
            )) : (
              <div>
                <span>WALLET TRANSACTION</span>
                <b>{requestDetails.walletTransactionId || 'No transaction reference'}</b>
              </div>
            )}
            <div>
              <span>STATUS</span>
              <b>{requestDetails.status}</b>
            </div>
            {requestDetails.providerReference && (
              <div><span>PROVIDER REFERENCE</span><b>{requestDetails.providerReference}</b></div>
            )}
            {requestDetails.completedAt && (
              <div><span>COMPLETED</span><b>{new Date(requestDetails.completedAt).toLocaleString()}</b></div>
            )}
            <div>
              <span>DESTINATION</span>
              <b>{requestDetails.destination?.upiId || requestDetails.destination?.email}</b>
            </div>
            <div>
              <span>STATUS HISTORY</span>
              <b>
                {requestDetails.statusHistory
                  ?.map(
                    (event) =>
                      `${event.status} · ${new Date(event.at).toLocaleString()} · ${event.actorRole || 'SYSTEM'} ${event.actorId || ''} · ${event.reason}`,
                  )
                  .join(' | ')}
              </b>
            </div>
          </div>
        </div>
      )}
      <div className={s.adminBlock} id="admin-redemptions">
        <div className={s.adminBlockHead}>
          <div>
            <h3>Redemption requests</h3>
            <p>Review destination details and record a reason for every status change.</p>
          </div>
        </div>
        <div className={s.adminFilters}>
          <label>
            Search reference, user ID, name or email
            <input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} />
          </label>
          <label>
            Method
            <select value={requestMethod} onChange={(event) => setRequestMethod(event.target.value)}>
              <option value="">All methods</option>
              <option value="upi">UPI</option>
              <option value="amazon">Amazon</option>
              <option value="googlePlay">Google Play</option>
            </select>
          </label>
          <label>
            Status
            <select value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}>
              <option value="">All statuses</option>
              {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'].map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Sort
            <select value={requestSort} onChange={(event) => setRequestSort(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>REFERENCE</th>
                <th>USER</th>
                <th>METHOD</th>
                <th>REWARD</th>
                <th>COST</th>
                <th>STATUS</th>
                <th>SUBMITTED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 4 }, (_, index) => (
                <tr key={`request-skeleton-${index}`} aria-hidden="true">
                  <td colSpan="8"><span className={s.tableSkeleton} /></td>
                </tr>
              )) : data.redemptions.map((r) => (
                <tr key={r._id}>
                  <td>
                    <button className={s.tableLink} onClick={() => openRequest(r._id)}>
                      {r.referenceId}
                    </button>
                  </td>
                  <td>
                    <button className={s.tableLink} onClick={() => openUser(r.userId)}>
                      {String(r.userId).slice(-8)}
                    </button>
                  </td>
                  <td>{METHODS[r.method]?.name}</td>
                  <td className={s.rewardCell}>
                    {r.rewardSnapshot?.displayName}
                    <small>{money(r.rewardSnapshot?.denomination, r.rewardSnapshot?.currency)}</small>
                  </td>
                  <td>{r.requiredVEs.toLocaleString('en-IN')} VE</td>
                  <td>
                    <span className={`${s.status} ${s[`status_${r.status}`]}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <div className={s.rowActions}>
                      {r.status === 'PENDING' && (
                        <>
                          <button onClick={() => confirmAction({
                            title: 'Mark request as processing?',
                            description: `Move ${r.referenceId} into review and record this action in the audit log.`,
                            requireReason: true,
                            run: (reason) => updateRequest(r._id, 'UNDER_REVIEW', reason),
                          })}>
                            Mark processing
                          </button>
                          <button onClick={() => confirmAction({
                            title: 'Approve this redemption?',
                            description: `Approve ${r.referenceId} for ${r.requiredVEs.toLocaleString('en-IN')} VEs. This action is audited.`,
                            requireReason: true,
                            run: (reason) => updateRequest(r._id, 'APPROVED', reason),
                          })}>Approve</button>
                          <button
                            className={s.dangerAction}
                            onClick={() => confirmAction({
                              title: 'Reject this redemption?',
                              description: `${r.referenceId} will be rejected and the backend will apply its configured reversal policy.`,
                              requireReason: true,
                              destructive: true,
                              run: (reason) => updateRequest(r._id, 'REJECTED', reason),
                            })}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === 'UNDER_REVIEW' && (
                        <>
                          <button onClick={() => confirmAction({
                            title: 'Approve this redemption?',
                            description: `Approve ${r.referenceId} for ${r.requiredVEs.toLocaleString('en-IN')} VEs. This action is audited.`,
                            requireReason: true,
                            run: (reason) => updateRequest(r._id, 'APPROVED', reason),
                          })}>Approve</button>
                          <button
                            className={s.dangerAction}
                            onClick={() => confirmAction({
                              title: 'Reject this redemption?',
                              description: `${r.referenceId} will be rejected and the backend will apply its configured reversal policy.`,
                              requireReason: true,
                              destructive: true,
                              run: (reason) => updateRequest(r._id, 'REJECTED', reason),
                            })}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === 'APPROVED' && (
                        <>
                          <button onClick={() => confirmAction({
                            title: 'Mark redemption completed?',
                            description: `Confirm provider fulfillment for ${r.referenceId}.`,
                            requireReason: true,
                            providerReference: true,
                            run: (reason, providerRef) => updateRequest(r._id, 'COMPLETED', reason, providerRef),
                          })}>Mark complete</button>
                          <button className={s.dangerAction} onClick={() => confirmAction({
                            title: 'Mark redemption failed?',
                            description: `The backend will apply its configured reversal policy for ${r.referenceId}.`,
                            requireReason: true,
                            destructive: true,
                            run: (reason) => updateRequest(r._id, 'FAILED', reason),
                          })}>Mark failed</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !data.redemptions.length && (
            <div className={s.tableEmpty} role="status">No redemption requests match these filters.</div>
          )}
        </div>
        <div className={s.pagination}>
          <span>{data.redemptionTotal} total · page {requestPage} of {pageCount(data.redemptionTotal)}</span>
          <div>
            <button disabled={requestPage <= 1} onClick={() => setRequestPage(requestPage - 1)} aria-label="Previous request page"><ChevronLeft size={16} /></button>
            <button disabled={requestPage >= pageCount(data.redemptionTotal)} onClick={() => setRequestPage(requestPage + 1)} aria-label="Next request page"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      <div className={s.adminColumns}>
        <div className={s.adminBlock} id="admin-methods">
          <div className={s.adminBlockHead}>
            <div>
              <h3>Payout methods</h3>
              <p>Methods start disabled. Enable only after configuration is approved.</p>
            </div>
          </div>
          {data.methods.map((m) => {
            const draft = methodDrafts[m._id] || m;
            return (
              <div className={s.configEditor} key={m._id}>
                <div className={s.configRow}>
                  <div>
                    <b>{m.displayName}</b>
                    <small>{m.active ? 'Currently available' : (m.maintenanceMessage || 'Unavailable until enabled')}</small>
                  </div>
                  <button
                    className={`${s.toggle} ${m.active ? s.toggleOn : ''}`}
                    onClick={() => confirmAction({
                      title: `${m.active ? 'Disable' : 'Enable'} ${m.displayName}?`,
                      description: m.active
                        ? 'Disabling this method will stop new redemptions immediately. Existing requests remain available for review.'
                        : 'Enabling this method makes its active reward options available to users.',
                      requireReason: true,
                      destructive: m.active,
                      run: (reason) => updateMethod(m, { active: !m.active }, reason, true),
                    })}
                    aria-label={`Toggle ${m.displayName}`}
                  ><span /></button>
                </div>
                <form className={s.optionForm} onSubmit={(event) => {
                  event.preventDefault();
                  updateMethod(m, {
                    displayName: draft.displayName,
                    description: draft.description,
                    maintenanceMessage: draft.maintenanceMessage,
                    sortOrder: Number(draft.sortOrder),
                  });
                }}>
                  <input aria-label={`${m.displayName} display name`} value={draft.displayName} onChange={(event) => updateDraft(setMethodDrafts, m._id, draft, 'displayName', event.target.value)} required />
                  <input aria-label={`${m.displayName} description`} value={draft.description || ''} onChange={(event) => updateDraft(setMethodDrafts, m._id, draft, 'description', event.target.value)} placeholder="Description" />
                  <input aria-label={`${m.displayName} unavailable message`} value={draft.maintenanceMessage || ''} onChange={(event) => updateDraft(setMethodDrafts, m._id, draft, 'maintenanceMessage', event.target.value)} placeholder="Unavailable message" />
                  <input type="number" min="0" max="1000" aria-label={`${m.displayName} sort order`} value={draft.sortOrder ?? 0} onChange={(event) => updateDraft(setMethodDrafts, m._id, draft, 'sortOrder', event.target.value)} />
                  <button className={s.outlineButton}>Save method details</button>
                </form>
              </div>
            );
          })}
        </div>
        <div className={s.adminBlock} id="admin-options">
          <div className={s.adminBlockHead}>
            <div>
              <h3>Reward options</h3>
              <p>Enter values only from verified platform configuration.</p>
            </div>
          </div>
          <form className={s.optionForm} onSubmit={createOption}>
            <select
              aria-label="New reward payout method"
              value={newOption.method}
              onChange={(e) => setNewOption({ ...newOption, method: e.target.value })}
            >
              <option value="upi">UPI</option>
              <option value="amazon">Amazon</option>
              <option value="googlePlay">Google Play</option>
            </select>
            <input
              required
              aria-label="New reward display name"
              placeholder="Reward label"
              value={newOption.displayName}
              onChange={(e) => setNewOption({ ...newOption, displayName: e.target.value })}
            />
            <div className={s.twoInputs}>
              <input
                required
                aria-label="New reward denomination"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Denomination (INR)"
                value={newOption.denomination}
                onChange={(e) => setNewOption({ ...newOption, denomination: e.target.value })}
              />
              <input
                required
                aria-label="New reward required VE amount"
                type="number"
                step="1"
                min="1"
                placeholder="Required VEs"
                value={newOption.requiredVEs}
                onChange={(e) => setNewOption({ ...newOption, requiredVEs: e.target.value })}
              />
            </div>
            <input
              aria-label="New reward description"
              placeholder="Description (optional)"
              value={newOption.description}
              onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
            />
            <input
              aria-label="New reward icon asset reference"
              placeholder="Icon asset reference (optional)"
              value={newOption.assetReference || ''}
              onChange={(e) => setNewOption({ ...newOption, assetReference: e.target.value })}
            />
            <button className={s.primarySmall}>Save inactive option</button>
          </form>
          {data.options.map((o) => {
            const draft = optionDrafts[o._id] || o;
            return (
              <div className={s.configEditor} key={o._id}>
                <div className={s.configRow}>
                  <div>
                    <b>{o.displayName} · {money(o.denomination, o.currency)}</b>
                    <small>{o.requiredVEs.toLocaleString('en-IN')} VE · {METHODS[o.method]?.name}</small>
                    <small>Reward ID: {o.rewardId} · Updated {new Date(o.updatedAt).toLocaleString()}</small>
                  </div>
                  <button
                    className={`${s.toggle} ${o.active ? s.toggleOn : ''}`}
                    onClick={() => {
                      const active = !o.active;
                      confirmAction({
                        title: `${active ? 'Enable' : 'Disable'} ${o.displayName}?`,
                        description: `${o.displayName} will ${active ? 'become available' : 'stop being offered'} using its currently saved denomination and VE cost.`,
                        requireReason: true,
                        destructive: !active,
                        run: (reason) => toggleOption(o, { active }, reason),
                      });
                    }}
                    aria-label={`Toggle ${o.displayName}`}
                  ><span /></button>
                </div>
                <form className={s.optionForm} onSubmit={(event) => {
                  event.preventDefault();
                  const changes = {
                    displayName: draft.displayName,
                    denomination: Number(draft.denomination),
                    requiredVEs: Number(draft.requiredVEs),
                    description: draft.description,
                    assetReference: draft.assetReference || '',
                    sortOrder: Number(draft.sortOrder),
                  };
                  const costChanged = changes.denomination !== o.denomination || changes.requiredVEs !== o.requiredVEs;
                  confirmAction({
                    title: costChanged ? 'Change reward cost?' : 'Save reward configuration?',
                    description: costChanged
                      ? `Update ${o.displayName} to ${changes.requiredVEs.toLocaleString('en-IN')} VEs and ${money(changes.denomination, o.currency)}? Existing requests keep their stored reward snapshot.`
                      : `Save the updated configuration for ${o.displayName}. This change will be recorded in the audit log.`,
                    requireReason: true,
                    run: (reason) => toggleOption(o, changes, reason),
                  });
                }}>
                  <input aria-label={`${o.displayName} reward label`} value={draft.displayName} onChange={(event) => updateDraft(setOptionDrafts, o._id, draft, 'displayName', event.target.value)} required />
                  <div className={s.twoInputs}>
                    <input type="number" min="0.01" step="0.01" aria-label={`${o.displayName} denomination`} value={draft.denomination} onChange={(event) => updateDraft(setOptionDrafts, o._id, draft, 'denomination', event.target.value)} required />
                    <input type="number" min="1" step="1" aria-label={`${o.displayName} VE cost`} value={draft.requiredVEs} onChange={(event) => updateDraft(setOptionDrafts, o._id, draft, 'requiredVEs', event.target.value)} required />
                  </div>
                  <input aria-label={`${o.displayName} description`} value={draft.description || ''} onChange={(event) => updateDraft(setOptionDrafts, o._id, draft, 'description', event.target.value)} placeholder="Reward description" />
                  <input aria-label={`${o.displayName} icon asset reference`} value={draft.assetReference || ''} onChange={(event) => updateDraft(setOptionDrafts, o._id, draft, 'assetReference', event.target.value)} placeholder="Icon asset reference (optional)" />
                  <input type="number" min="0" max="1000" aria-label={`${o.displayName} sort order`} value={draft.sortOrder ?? 0} onChange={(event) => updateDraft(setOptionDrafts, o._id, draft, 'sortOrder', event.target.value)} />
                  <button className={s.outlineButton}>Save reward configuration</button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
      <div className={s.adminBlock} id="admin-users">
        <div className={s.adminBlockHead}>
          <div>
            <h3>User lookup</h3>
            <p>Search payout users without exposing password or token fields.</p>
          </div>
          <input
            className={s.searchInput}
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
          />
        </div>
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>USER</th>
                <th>EMAIL</th>
                <th>AVAILABLE VEs</th>
                <th>REDEMPTIONS</th>
                <th>ACCOUNT</th>
                <th>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 3 }, (_, index) => (
                <tr key={`user-skeleton-${index}`} aria-hidden="true">
                  <td colSpan="6"><span className={s.tableSkeleton} /></td>
                </tr>
              )) : data.users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{(u.wallet?.availableBalance || 0).toLocaleString('en-IN')}</td>
                  <td>{u.redemptionCount}</td>
                  <td>{u.active ? 'Active' : 'Restricted'}</td>
                  <td><button className={s.tableLink} onClick={() => openUser(u._id)}>View history</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !data.users.length && <div className={s.tableEmpty} role="status">No matching users.</div>}
        </div>
        <div className={s.pagination}>
          <span>{data.userTotal} users · page {userPage} of {pageCount(data.userTotal)}</span>
          <div>
            <button disabled={userPage <= 1} onClick={() => setUserPage(userPage - 1)} aria-label="Previous user page"><ChevronLeft size={16} /></button>
            <button disabled={userPage >= pageCount(data.userTotal)} onClick={() => setUserPage(userPage + 1)} aria-label="Next user page"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      {userDetails && (
        <div className={s.adminBlock}>
          <div className={s.adminBlockHead}>
            <div>
              <h3><UserRound size={17} /> {userDetails.user.name || userDetails.user.email}</h3>
              <p>{userDetails.user.email} · user ID {userDetails.user._id}</p>
            </div>
            <div className={s.rowActions}>
              <button className={userDetails.user.active ? s.dangerAction : ''} onClick={() => confirmAction({
                title: `${userDetails.user.active ? 'Suspend' : 'Restore'} payout access?`,
                description: `Apply this access change to ${userDetails.user.email}. The action will be recorded in the audit log.`,
                requireReason: true,
                destructive: userDetails.user.active,
                run: (reason) => updateUserAccess(userDetails.user, reason),
              })}>
                {userDetails.user.active ? 'Suspend payout access' : 'Restore payout access'}
              </button>
              <button className={s.outlineButton} onClick={closeUser}>Close</button>
            </div>
          </div>
          <p>Wallet: {userDetails.wallet?.availableBalance?.toLocaleString('en-IN') ?? '—'} available VEs · {userDetails.wallet?.reservedBalance?.toLocaleString('en-IN') ?? '—'} reserved VEs</p>
          <h4>Recent payout requests</h4>
          {userDetails.redemptions.length ? userDetails.redemptions.slice(0, 20).map((row) => (
            <div className={s.configRow} key={row._id}>
              <div><b>{row.referenceId} · {row.rewardSnapshot?.displayName}</b><small>{row.status} · {row.requiredVEs.toLocaleString('en-IN')} VEs · {new Date(row.createdAt).toLocaleString()}</small></div>
              <button className={s.tableLink} onClick={() => openRequest(row._id)}>Review</button>
            </div>
          )) : <div className={s.tableEmpty}>No payout requests recorded.</div>}
          <h4>Recent wallet transactions</h4>
          {userDetails.transactions.length ? userDetails.transactions.slice(0, 20).map((row) => (
            <div className={s.configRow} key={row._id}>
              <div><b>{row.referenceId || row.transactionId} · {row.type}</b><small>{row.amount.toLocaleString('en-IN')} {row.currency} · {row.balanceBefore?.toLocaleString('en-IN')} to {row.balanceAfter?.toLocaleString('en-IN')} · {new Date(row.createdAt).toLocaleString()}</small></div>
            </div>
          )) : <div className={s.tableEmpty}>No wallet transactions recorded.</div>}
        </div>
      )}
      <div className={s.adminColumns}>
        <div className={s.adminBlock} id="admin-transactions">
          <div className={s.adminBlockHead}>
            <div>
              <h3>Wallet ledger</h3>
              <p>Recent balance changes and request links.</p>
            </div>
          </div>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>TRANSACTION</th>
                  <th>USER</th>
                  <th>TYPE</th>
                  <th>CURRENCY / AMOUNT</th>
                  <th>BALANCE BEFORE / AFTER</th>
                  <th>RELATED REDEMPTION</th>
                  <th>STATUS / TIME</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 3 }, (_, index) => (
                  <tr key={`transaction-skeleton-${index}`} aria-hidden="true">
                    <td colSpan="7"><span className={s.tableSkeleton} /></td>
                  </tr>
                )) : data.transactions.map((t) => (
                  <tr key={t._id}>
                    <td className={s.mono}>
                      {t.transactionId}
                      <small>{t.referenceId ? `Request ${t.referenceId}` : 'No redemption reference'}</small>
                    </td>
                    <td><button className={s.tableLink} onClick={() => openUser(t.userId)}>{String(t.userId).slice(-8)}</button></td>
                    <td>{t.type.replace('REDEMPTION_', '')}</td>
                    <td>{t.currency} {t.amount.toLocaleString('en-IN')}</td>
                    <td>
                      {t.balanceBefore?.toLocaleString('en-IN')} → {t.balanceAfter?.toLocaleString('en-IN')}
                    </td>
                    <td>{t.referenceId || '—'}</td>
                    <td>{t.status} · {new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !data.transactions.length && (
              <div className={s.tableEmpty} role="status">No transactions match this page.</div>
            )}
          </div>
          <div className={s.pagination}>
            <span>{data.transactionTotal} transactions · page {transactionPage} of {pageCount(data.transactionTotal)}</span>
            <div>
              <button disabled={transactionPage <= 1} onClick={() => setTransactionPage(transactionPage - 1)} aria-label="Previous transaction page"><ChevronLeft size={16} /></button>
              <button disabled={transactionPage >= pageCount(data.transactionTotal)} onClick={() => setTransactionPage(transactionPage + 1)} aria-label="Next transaction page"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
        <div className={s.adminBlock} id="admin-audit">
          <div className={s.adminBlockHead}>
            <div>
              <h3>Audit log</h3>
              <p>Recent administrator activity.</p>
            </div>
          </div>
          {data.logs.map((log) => (
            <div className={s.configRow} key={log._id}>
              <div>
                <b>{log.action}</b>
                <small>
                  {log.actorRole || 'UNKNOWN'} {log.actorId ? `· ${log.actorId}` : ''} · {log.targetId} · {new Date(log.at).toLocaleString()} ·{' '}
                  {log.reason || 'No reason provided'}
                </small>
              </div>
            </div>
          ))}
          {!data.logs.length && <div className={s.tableEmpty}>No audit activity recorded.</div>}
        </div>
      </div>
      {pendingAction && (
        <div className={s.adminDialogBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !actionBusy) setPendingAction(null);
        }}>
          <form
            className={s.adminDialog}
            ref={actionDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-action-title"
            aria-describedby="admin-action-description"
            onSubmit={submitAction}
          >
            <span className={s.sectionKicker}>CONFIRM ADMIN ACTION</span>
            <h3 id="admin-action-title">{pendingAction.title}</h3>
            <p id="admin-action-description">{pendingAction.description}</p>
            {pendingAction.providerReference && (
              <label>
                Provider reference <span>(optional)</span>
                <input
                  value={providerReference}
                  onChange={(event) => setProviderReference(event.target.value)}
                  maxLength={120}
                  autoFocus
                />
              </label>
            )}
            {pendingAction.requireReason && (
              <label>
                Audit reason
                <textarea
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  minLength={3}
                  maxLength={500}
                  required
                  autoFocus={!pendingAction.providerReference}
                  placeholder="Explain why this action is needed"
                />
              </label>
            )}
            {actionError && <p className={s.adminDialogError} role="alert">{actionError}</p>}
            <div className={s.modalActions}>
              <button type="button" className={s.outlineButton} disabled={actionBusy} onClick={() => setPendingAction(null)}>
                Cancel
              </button>
              <button type="submit" className={pendingAction.destructive ? s.adminDangerButton : s.primarySmall} disabled={actionBusy}>
                {actionBusy ? 'Saving…' : 'Confirm action'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
