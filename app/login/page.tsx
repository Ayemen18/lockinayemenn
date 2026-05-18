'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function signInWithGoogle() {
    setErrorMsg('')
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    })
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (isSignUp) {
      // Validate matching passwords
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.')
        setLoading(false)
        return
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      // Register logic
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback`
        }
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        if (data?.session) {
          router.push('/home')
        } else {
          setSuccessMsg('Account created successfully! Check your email for confirmation.')
        }
      }
    } else {
      // Login logic
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        router.push('/home')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-100 font-sans p-4">
      <div className="w-full max-w-sm px-6 py-10 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl relative overflow-hidden">
        
        {/* Subtle accent glow */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-green-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-neutral-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Branding header */}
        <div className="mb-8 text-center">
          {/* Dynamic Icon Accent */}
          <motion.div
            animate={{
              borderColor: isSignUp ? '#22c55e' : '#404040',
              color: isSignUp ? '#22c55e' : '#ffffff',
            }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-800 border text-white font-bold mb-4 shadow-inner text-base"
          >
            ▦
          </motion.div>
          
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">LockIn</h1>
          
          {/* Dynamic Subtitle */}
          <div className="h-4 overflow-hidden relative w-full flex justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={isSignUp ? 'signup-sub' : 'signin-sub'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className={`text-[10px] font-semibold uppercase tracking-widest absolute ${
                  isSignUp ? 'text-green-400' : 'text-neutral-500'
                }`}
              >
                {isSignUp ? 'Create Performance Account' : 'High-Performance Analytics'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Alerts Banner */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-950/40 border border-red-900/30 text-red-400 text-[11px] font-mono p-3 rounded-xl mb-5 leading-normal"
            >
              ⚠ {errorMsg}
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-green-950/40 border border-green-900/30 text-green-400 text-[11px] font-mono p-3 rounded-xl mb-5 leading-normal"
            >
              ✓ {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form elements */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@email.com"
              required
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-800 font-mono"
            />
          </div>

          <div>
            <label className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-800 font-mono"
            />
          </div>

          {/* Sliding Confirm Password field for Sign Up */}
          <AnimatePresence initial={false}>
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.23, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <label className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required={isSignUp}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-800 font-mono"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action button */}
          <div className="pt-2">
            <motion.button
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black text-xs font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </motion.button>
          </div>
        </form>

        {/* Mode Toggle Link */}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg('')
              setSuccessMsg('')
              setConfirmPassword('')
            }}
            className="text-[11px] text-neutral-500 hover:text-neutral-350 transition-colors font-mono uppercase tracking-wider"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Sleek divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800/80"></div>
          </div>
          <span className="relative bg-neutral-900 px-3 text-[10px] text-neutral-600 font-mono uppercase tracking-widest">or</span>
        </div>

        {/* OAuth elements */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-800 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" className="flex-shrink-0">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

      </div>
    </div>
  )
}