'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { toast } from "@/components/ui/use-toast"

const ChatInterface = dynamic(() => import('@/components/ChatInterface'), {
  loading: () => <p>Loading...</p>,
  ssr: false
})

export default function Home() {
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false)
  const [isChecked, setIsChecked] = useState(false)

  const handleConfirmAge = () => {
    if (isChecked) {
      setIsAgeConfirmed(true)
    } else {
      toast({
        title: "Age Confirmation Required",
        description: "Please confirm that you are at least 15 years old.",
        variant: "destructive",
      })
    }
  }

  if (!isAgeConfirmed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Welcome to vmigle</h1>
          <p className="mb-6 text-gray-600">Please confirm that you are at least 15 years old to enter vmigle.</p>
          <div className="flex items-center space-x-2 mb-6">
            <Checkbox 
              id="age-confirm" 
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked as boolean)}
            />
            <label
              htmlFor="age-confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I confirm that I am at least 15 years old
            </label>
          </div>
          <Button onClick={handleConfirmAge} disabled={!isChecked} className="w-full mb-4">
            Enter vmigle
          </Button>
          <div className="text-sm text-gray-500 text-center">
            By entering, you agree to our <Link href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link> and <Link href="/terms-of-service" className="text-blue-600 hover:underline">Terms of Service</Link>.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <ChatInterface />
    </main>
  )
}

