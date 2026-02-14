"use client"

import { useEffect } from "react"

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  message: string
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, message }: ConfirmModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  // Handle overlay click (only close when clicking overlay, not modal content)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Confirm Show Words
        </h3>

        <p className="text-sm text-gray-600 mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          {/* Cancel Button - Blue */}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Cancel
          </button>

          {/* Show Button - Red */}
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Show
          </button>
        </div>
      </div>
    </div>
  )
}
