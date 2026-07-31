import {
  clearWorkspaceCredentials,
  createRemoteWorkspace,
  fetchRemoteWorkspace,
  loadWorkspaceCredentials,
  saveWorkspaceCredentials,
  updateRemoteWorkspace,
  WorkspaceApiError,
  type WorkspaceCredentials,
} from "@/lib/workspace-api"
import { getWorkspaceSnapshot, useWorkspaceStore } from "@/store/workspace-store"
import type { WorkspaceSnapshot } from "@/types/document"

const SYNC_DELAY_MS = 900

let started = false
let ready = false
let syncTimer: ReturnType<typeof setTimeout> | undefined
let syncInFlight = false
let syncAgain = false
let credentials: WorkspaceCredentials | null = null
let lastSyncedContentSignature: string | null = null

const getWorkspaceContentSignature = (snapshot: WorkspaceSnapshot) =>
  `${snapshot.lastSavedAt ?? ""}:${JSON.stringify(snapshot.nodes)}`

const workspaceContentMatches = (left: WorkspaceSnapshot, right: WorkspaceSnapshot) =>
  getWorkspaceContentSignature(left) === getWorkspaceContentSignature(right)

const clearScheduledSync = () => {
  if (!syncTimer) return
  clearTimeout(syncTimer)
  syncTimer = undefined
}

const setCloudFailure = (error: unknown, fallback: string) => {
  const state = useWorkspaceStore.getState()

  if (!navigator.onLine || error instanceof TypeError) {
    state.setCloudState("offline", {
      error: "Cloud sync is unavailable. Your changes remain stored in this browser.",
    })
    return
  }

  if (error instanceof WorkspaceApiError && error.status === 409) {
    state.setCloudState("conflict", {
      error: "The local and cloud copies both changed. Choose which copy to keep.",
    })
    return
  }

  state.setCloudState("error", {
    error: error instanceof Error ? error.message : fallback,
  })
}

const scheduleSync = () => {
  if (!ready) return
  clearScheduledSync()
  syncTimer = setTimeout(() => {
    syncTimer = undefined
    void syncWorkspace()
  }, SYNC_DELAY_MS)
}

const createWorkspaceFromLocalState = async () => {
  const state = useWorkspaceStore.getState()
  const submittedSnapshot = getWorkspaceSnapshot(state)
  state.setCloudState("connecting", { error: null })

  const remote = await createRemoteWorkspace(submittedSnapshot)
  credentials = {
    workspaceId: remote.workspaceId,
    accessToken: remote.accessToken,
  }
  saveWorkspaceCredentials(credentials)
  lastSyncedContentSignature = getWorkspaceContentSignature(remote.snapshot)
  useWorkspaceStore.getState().setCloudState("synced", {
    error: null,
    revision: remote.revision,
  })

  return (
    getWorkspaceContentSignature(getWorkspaceSnapshot(useWorkspaceStore.getState())) !==
    lastSyncedContentSignature
  )
}

const bootstrap = async () => {
  const store = useWorkspaceStore.getState()

  if (!navigator.onLine) {
    ready = true
    store.setCloudState("offline", { error: "Changes will sync when the connection returns." })
    return
  }

  store.setCloudState("connecting", { error: null })
  credentials = loadWorkspaceCredentials()

  if (!credentials) {
    const hasPendingLocalChanges = await createWorkspaceFromLocalState()
    ready = true
    if (hasPendingLocalChanges) scheduleSync()
    return
  }

  let syncLocalChanges = false

  try {
    const remote = await fetchRemoteWorkspace(credentials)
    const current = useWorkspaceStore.getState()
    const localSnapshot = getWorkspaceSnapshot(current)
    lastSyncedContentSignature = getWorkspaceContentSignature(remote.snapshot)

    if (workspaceContentMatches(localSnapshot, remote.snapshot)) {
      current.setCloudState("synced", {
        error: null,
        revision: remote.revision,
      })
    } else if (current.remoteRevision === remote.revision) {
      current.setCloudState("synced", {
        error: null,
        revision: remote.revision,
      })
      syncLocalChanges = true
    } else {
      current.setCloudState("conflict", {
        error: "The local and cloud copies both changed. Choose which copy to keep.",
        revision: remote.revision,
      })
    }
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 404) {
      clearWorkspaceCredentials()
      credentials = null
      syncLocalChanges = await createWorkspaceFromLocalState()
    } else {
      throw error
    }
  }

  ready = true
  if (syncLocalChanges) scheduleSync()
}

const syncWorkspace = async () => {
  if (!ready) return

  const current = useWorkspaceStore.getState()
  if (current.cloudStatus === "conflict") return

  if (!navigator.onLine) {
    current.setCloudState("offline", {
      error: "Changes are saved locally and will sync when you are back online.",
    })
    return
  }

  if (syncInFlight) {
    syncAgain = true
    return
  }

  const currentSnapshot = getWorkspaceSnapshot(current)
  if (
    current.remoteRevision &&
    getWorkspaceContentSignature(currentSnapshot) === lastSyncedContentSignature
  ) {
    current.setCloudState("synced", { error: null })
    return
  }

  syncInFlight = true

  try {
    if (!credentials) credentials = loadWorkspaceCredentials()

    if (!credentials) {
      if (await createWorkspaceFromLocalState()) syncAgain = true
      return
    }

    const state = useWorkspaceStore.getState()
    const baseRevision = state.remoteRevision
    if (!baseRevision) {
      state.setCloudState("conflict", {
        error: "The cloud revision is unknown. Choose which copy to keep before syncing.",
      })
      return
    }

    const submittedSnapshot = getWorkspaceSnapshot(state)
    const submittedSignature = getWorkspaceContentSignature(submittedSnapshot)
    state.setCloudState("syncing", { error: null })
    const result = await updateRemoteWorkspace(
      credentials,
      baseRevision,
      submittedSnapshot,
    )
    lastSyncedContentSignature = submittedSignature
    useWorkspaceStore.getState().setCloudState("synced", {
      error: null,
      revision: result.revision,
    })

    if (
      getWorkspaceContentSignature(getWorkspaceSnapshot(useWorkspaceStore.getState())) !==
      submittedSignature
    ) {
      syncAgain = true
    }
  } catch (error) {
    setCloudFailure(error, "Cloud sync failed.")
  } finally {
    syncInFlight = false
    if (syncAgain) {
      syncAgain = false
      scheduleSync()
    }
  }
}

export const reloadCloudWorkspace = async () => {
  if (syncInFlight) return
  clearScheduledSync()

  if (!navigator.onLine) {
    useWorkspaceStore.getState().setCloudState("offline", {
      error: "Connect to the internet before loading the cloud copy.",
    })
    return
  }

  syncInFlight = true
  const state = useWorkspaceStore.getState()
  state.setCloudState("connecting", { error: null })

  try {
    if (!credentials) credentials = loadWorkspaceCredentials()
    if (!credentials) throw new Error("No cloud workspace is connected to this browser.")

    const remote = await fetchRemoteWorkspace(credentials)
    lastSyncedContentSignature = getWorkspaceContentSignature(remote.snapshot)
    useWorkspaceStore.getState().replaceWorkspace(remote.snapshot, remote.revision)
  } catch (error) {
    setCloudFailure(error, "Unable to load the cloud copy.")
  } finally {
    syncInFlight = false
  }
}

export const overwriteCloudWorkspace = async () => {
  if (syncInFlight) return
  clearScheduledSync()

  if (!navigator.onLine) {
    useWorkspaceStore.getState().setCloudState("offline", {
      error: "Connect to the internet before replacing the cloud copy.",
    })
    return
  }

  syncInFlight = true
  const state = useWorkspaceStore.getState()
  state.setCloudState("syncing", { error: null })

  try {
    if (!credentials) credentials = loadWorkspaceCredentials()
    if (!credentials) throw new Error("No cloud workspace is connected to this browser.")

    const remote = await fetchRemoteWorkspace(credentials)
    const submittedSnapshot = getWorkspaceSnapshot(useWorkspaceStore.getState())
    const submittedSignature = getWorkspaceContentSignature(submittedSnapshot)
    const result = await updateRemoteWorkspace(
      credentials,
      remote.revision,
      submittedSnapshot,
    )
    lastSyncedContentSignature = submittedSignature
    useWorkspaceStore.getState().setCloudState("synced", {
      error: null,
      revision: result.revision,
    })

    if (
      getWorkspaceContentSignature(getWorkspaceSnapshot(useWorkspaceStore.getState())) !==
      submittedSignature
    ) {
      syncAgain = true
    }
  } catch (error) {
    setCloudFailure(error, "Unable to replace the cloud copy.")
  } finally {
    syncInFlight = false
    if (syncAgain) {
      syncAgain = false
      scheduleSync()
    }
  }
}

export const retryCloudSync = () => {
  if (!ready || useWorkspaceStore.getState().cloudStatus === "conflict") return
  void syncWorkspace()
}

export const startCloudSync = () => {
  if (started || typeof window === "undefined") return
  started = true

  useWorkspaceStore.subscribe((state, previous) => {
    const documentDataChanged =
      state.nodes !== previous.nodes || state.lastSavedAt !== previous.lastSavedAt

    if (documentDataChanged) scheduleSync()
  })

  window.addEventListener("online", retryCloudSync)
  window.addEventListener("offline", () => {
    useWorkspaceStore.getState().setCloudState("offline", {
      error: "Changes are saved locally and will sync when you are back online.",
    })
  })

  void bootstrap().catch((error) => {
    ready = true
    setCloudFailure(error, "Unable to initialize cloud sync.")
  })
}
