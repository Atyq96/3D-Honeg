import { Component, type ReactNode } from 'react'

interface Props {
  onError: (error: Error) => void
  children: ReactNode
}

/** Catches failures in the 3D tree (model load, shader compile, context creation). */
export class ViewerErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[viewer]', error)
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
