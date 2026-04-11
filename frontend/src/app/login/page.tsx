'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [googlePending, setGooglePending] = useState(false)

  // 다른 탭(이메일 링크 클릭한 새 탭)에서 인증되면 이 탭도 자동 이동
  useEffect(() => {
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) router.replace('/clones')
        })
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  async function handleGoogleLogin() {
    setGooglePending(true)
    setErrorMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      setGooglePending(false)
    }
    // 성공 시 Supabase가 자동으로 Google 동의 화면으로 redirect → 이 컴포넌트 unmount
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Google 계정 또는 이메일 매직링크로 로그인하세요.
        </p>

        <div className="mt-6 space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={googlePending || status === 'sending'}
          >
            {googlePending ? '이동 중...' : 'Google로 계속하기'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                또는
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={status === 'sending' || status === 'sent' || googlePending}
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={status === 'sending' || status === 'sent' || googlePending}
            >
              {status === 'sending' ? '전송 중...' : '매직링크 보내기'}
            </Button>
          </form>

          {status === 'sent' && (
            <div className="space-y-1 text-sm text-green-600">
              <p>✓ {email} 로 매직링크를 보냈습니다.</p>
              <p className="text-xs text-muted-foreground">
                메일의 링크를 누르면 이 창이 자동으로 이동합니다. 새로 열린 탭은 닫아도 됩니다.
              </p>
            </div>
          )}

          {status === 'error' && errorMsg && (
            <p className="text-sm text-destructive">✗ {errorMsg}</p>
          )}
        </div>
      </Card>
    </main>
  )
}
