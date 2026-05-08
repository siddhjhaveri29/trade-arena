import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/shared/Navbar'
import { GroupCard, InviteCodeDisplay } from '../components/Groups/GroupCard'
import { Leaderboard } from '../components/Groups/Leaderboard'
import { apiFetch } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function GroupsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(id ? 'detail' : 'list') // 'list' | 'create' | 'join' | 'detail'
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [createForm, setCreateForm] = useState({ name: '', description: '', market: 'IN', competitionType: 'all_time' })
  const [submitting, setSubmitting] = useState(false)

  async function fetchGroups() {
    try {
      const res = await apiFetch('/api/groups')
      const data = await res.json()
      setGroups(Array.isArray(data) ? data : [])
      if (id) {
        const found = data.find(g => g.id === id)
        if (found) setSelectedGroup(found)
      }
    } catch (e) {/* ignore */} finally { setLoading(false) }
  }

  useEffect(() => {
    fetchGroups()
    if (id) setView('detail')
  }, [id])

  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.name) { addToast('error', 'Group name required'); return }
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/groups', { method: 'POST', body: createForm })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addToast('success', `Group "${data.name}" created! Code: ${data.invite_code}`)
      fetchGroups()
      navigate(`/groups/${data.id}`)
    } catch (err) {
      addToast('error', err.message)
    } finally { setSubmitting(false) }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/groups/join', { method: 'POST', body: { inviteCode: inviteCode.trim() } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addToast('success', `Joined "${data.group.name}"!`)
      fetchGroups()
      navigate(`/groups/${data.group.id}`)
    } catch (err) {
      addToast('error', err.message)
    } finally { setSubmitting(false) }
  }

  if (id && selectedGroup) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto">
          {/* Group header */}
          <div className="bg-bg-secondary border-b border-border-color px-6 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/groups')} className="text-text-secondary hover:text-text-primary text-sm">←</button>
              <div>
                <h1 className="text-text-primary font-semibold text-lg">{selectedGroup.name}</h1>
                {selectedGroup.description && <p className="text-text-secondary text-xs mt-0.5">{selectedGroup.description}</p>}
              </div>
              <div className="ml-auto">
                <InviteCodeDisplay code={selectedGroup.invite_code} />
              </div>
            </div>
          </div>
          <div className="max-w-4xl mx-auto w-full py-4">
            <Leaderboard groupId={id} market={selectedGroup.market} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full p-6">
          {view === 'list' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-text-primary font-semibold text-xl">Groups & Competitions</h1>
                <div className="flex gap-2">
                  <button onClick={() => setView('join')} className="px-4 py-2 text-xs border border-border-color text-text-secondary rounded hover:bg-bg-hover">
                    Join Group
                  </button>
                  <button onClick={() => setView('create')} className="px-4 py-2 text-xs bg-trade-blue text-white rounded hover:bg-trade-blue/90">
                    + Create Group
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-text-secondary text-sm">Loading...</div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="text-5xl mb-4">🏆</span>
                  <h2 className="text-text-primary font-medium text-lg mb-2">No groups yet</h2>
                  <p className="text-text-secondary text-sm mb-6">Create a group and compete with friends</p>
                  <div className="flex gap-3">
                    <button onClick={() => setView('create')} className="px-5 py-2.5 bg-trade-blue text-white text-sm rounded">
                      Create a Group
                    </button>
                    <button onClick={() => setView('join')} className="px-5 py-2.5 border border-border-color text-text-secondary text-sm rounded">
                      Join with Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {groups.map(g => <GroupCard key={g.id} group={g} />)}
                </div>
              )}
            </>
          )}

          {view === 'create' && (
            <div className="max-w-lg mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setView('list')} className="text-text-secondary hover:text-text-primary">←</button>
                <h1 className="text-text-primary font-semibold text-lg">Create a Group</h1>
              </div>
              <form onSubmit={handleCreate} className="bg-bg-card border border-border-color rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-text-secondary text-xs mb-1">Group Name *</label>
                  <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required
                    className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                    placeholder="TradeFam 2025" />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs mb-1">Description</label>
                  <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                    placeholder="College friends paper trading competition" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-text-secondary text-xs mb-1">Market</label>
                    <select value={createForm.market} onChange={e => setCreateForm(f => ({ ...f, market: e.target.value }))}
                      className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary">
                      <option value="IN">🇮🇳 India</option>
                      <option value="US">🇺🇸 US</option>
                      <option value="BOTH">🌐 Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs mb-1">Competition</label>
                    <select value={createForm.competitionType} onChange={e => setCreateForm(f => ({ ...f, competitionType: e.target.value }))}
                      className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="all_time">All Time</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-2.5 bg-trade-blue text-white text-sm font-medium rounded hover:bg-trade-blue/90 disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Group'}
                </button>
              </form>
            </div>
          )}

          {view === 'join' && (
            <div className="max-w-sm mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setView('list')} className="text-text-secondary hover:text-text-primary">←</button>
                <h1 className="text-text-primary font-semibold text-lg">Join a Group</h1>
              </div>
              <div className="bg-bg-card border border-border-color rounded-xl p-5">
                <p className="text-text-secondary text-sm mb-4 text-center">Enter the 6-character invite code to join a group</p>
                <form onSubmit={handleJoin} className="space-y-4">
                  <input
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="TRD7X2"
                    className="w-full bg-bg-secondary border border-border-color rounded px-4 py-3 text-2xl font-mono font-bold text-trade-accent text-center tracking-widest outline-none focus:border-trade-blue"
                    maxLength={6}
                  />
                  <button type="submit" disabled={submitting || inviteCode.length !== 6}
                    className="w-full py-2.5 bg-trade-green text-white text-sm font-medium rounded hover:bg-trade-green/90 disabled:opacity-50">
                    {submitting ? 'Joining...' : 'Join Group'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
