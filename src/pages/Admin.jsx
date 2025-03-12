import React from 'react'
import EventForm from '../components/EventForm'

export default function Admin() {
  return (
    <div className="admin-flow">
      <h1>Admin Dashboard</h1>
      <EventForm />
      {/* Add other admin components here */}
    </div>
  )
}
