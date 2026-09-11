import { useState } from 'react'
import './App.css'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import NavigateTab from './features/navigate/NavigateTab'
import LearnTab from './features/learn/LearnTab'
import ServicesTab from './features/services/ServicesTab'

type Tab = 'navigate' | 'learn' | 'services'

function Shell() {
  const [tab, setTab] = useState<Tab>('navigate')
  const { profile, setProfile } = useProfile()

  return (
    <>
      <header>
        <h1>AiCamAssist</h1>
        <p>One camera, one profile, full independence.</p>
        <label style={{ display: 'block', marginTop: 8 }}>
          <input
            type="checkbox"
            checked={profile.highContrast}
            onChange={(e) => setProfile({ highContrast: e.target.checked })}
          />{' '}
          High contrast
        </label>
      </header>

      <nav role="tablist" aria-label="Tracks" className="tabs">
        <button role="tab" aria-selected={tab === 'navigate'} onClick={() => setTab('navigate')}>
          01 Navigate
        </button>
        <button role="tab" aria-selected={tab === 'learn'} onClick={() => setTab('learn')}>
          02 Learn
        </button>
        <button role="tab" aria-selected={tab === 'services'} onClick={() => setTab('services')}>
          03 Services
        </button>
      </nav>

      <main className={profile.highContrast ? 'hc' : ''}>
        {tab === 'navigate' && <NavigateTab />}
        {tab === 'learn' && <LearnTab />}
        {tab === 'services' && <ServicesTab />}
      </main>
    </>
  )
}

export default function App() {
  return (
    <ProfileProvider>
      <Shell />
    </ProfileProvider>
  )
}
