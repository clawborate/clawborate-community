'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export default function RejectModal({ open, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    onConfirm(reason)
    setReason('')
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Reject Template">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label">Reason (optional)</label>
          <textarea
            className="textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this template being rejected?"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={handleConfirm}
          >
            ✕ Confirm Reject
          </button>
        </div>
      </div>
    </Modal>
  )
}
