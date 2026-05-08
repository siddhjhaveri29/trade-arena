import { useState } from 'react'
import { Navbar } from '../components/shared/Navbar'
import { JournalList } from '../components/Journal/JournalList'
import { JournalStats } from '../components/Journal/JournalStats'

const TABS = ['Entries', 'Statistics']

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState('Entries')

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        {/* Tab header */}
        <div className="flex border-b border-border-color bg-bg-secondary sticky top-0 z-10">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-trade-blue border-b-2 border-trade-blue' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {tab === 'Entries' ? '📒 ' : '📊 '}
              {tab}
            </button>
          ))}
        </div>

        <div className="max-w-4xl mx-auto w-full">
          {activeTab === 'Entries' ? <JournalList /> : <JournalStats />}
        </div>
      </div>
    </div>
  )
}
