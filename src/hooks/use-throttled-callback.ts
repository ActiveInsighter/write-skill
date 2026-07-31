import throttle from "lodash.throttle"
import { useEffect, useMemo, useRef } from "react"

interface ThrottleSettings {
  leading?: boolean
  trailing?: boolean
}

const defaultOptions: Required<ThrottleSettings> = {
  leading: false,
  trailing: true,
}

/**
 * Return a throttled callback that always invokes the latest function and
 * cancels pending work when its configuration changes or the component unmounts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThrottledCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait = 250,
  dependencies: React.DependencyList = [],
  options: ThrottleSettings = defaultOptions,
): {
  (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T>
  cancel: () => void
  flush: () => void
} {
  const callbackRef = useRef(fn)
  callbackRef.current = fn

  const leading = options.leading ?? defaultOptions.leading
  const trailing = options.trailing ?? defaultOptions.trailing

  const handler = useMemo(
    () =>
      throttle(
        function throttledCallback(
          this: ThisParameterType<T>,
          ...args: Parameters<T>
        ) {
          return callbackRef.current.apply(this, args)
        } as T,
        wait,
        { leading, trailing },
      ),
    // The caller-provided dependencies intentionally control recreation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wait, leading, trailing, ...dependencies],
  )

  useEffect(() => () => handler.cancel(), [handler])

  return handler
}

export default useThrottledCallback
