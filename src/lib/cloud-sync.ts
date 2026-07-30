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

const SYNC_DELAY_MS = 900

let started = false
let ready = false
let syncTimer: ReturnType<typeof setTimeout> | undefined
let syncInFlight = false
let syncAgain = false
let credentials: WorkspaceCredentials | null = null

const setStatus = (
  status: Parameters<typeof useWorkspaceStore.getState>[0] extends never ? never : never,
) => status

const scheduleSync = () => {
  if (!ready) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    void syncWorkspace()
  }, SYNC_DELAY_MS)
}

const createWorkspaceFromLocalState = async () => {
  const state = useWorkspaceStore.getState()
  state.setCloudState("connecting", { error: null })

  const remote = await createRemoteWorkspace(getWorkspaceSnapshot(state))
  credentials = {
    workspaceId: remote.workspaceId,
    accessToken: remote.accessToken,
  }
  saveWorkspaceCredentials(credentials)
  state.setCloudState("synced", {
    error: null,
    revision: remote.revision,
  })
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
    await createWorkspaceFromLocalState()
    ready = true
    return
  }

  try {
    const remote = await fetchRemoteWorkspace(credentials)
    store.replaceWorkspace(remote.snapshot, remote.revision)
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 404) {
      clearWorkspaceCredentials()
      credentials = null
      await createWorkspaceFromLocalState()
    } else {
      throw error
    }
  }

  ready = true
}

const syncWorkspace = async () => {
  if (!ready) return

  if (!navigator.onLine) {
    useWorkspaceStore.getState().setCloudState("offline", {
      error: "Changes are saved locally and will sync when you are back online.",
    })
    return
  }

  if (syncInFlight) {
    syncAgain = true
    return
  }

  syncInFlight = true
  const state = useWorkspaceStore.getState()

  try {
    if (!credentials) {
      credentials = loadWorkspaceCredentials()
    }

    if (!credentials) {
      await createWorkspaceFromLocalState()
      return
    }

    const baseRevision = state.remoteRevision
    if (!baseRevision) {
      const remote = await fetchRemoteWorkspace(credentials)
      state.replaceWorkspace(remote.snapshot, remote.revision)
      return
    }

    state.setCloudState("syncing", { error: null })
    const result = await updateRemoteWorkspace(
      credentials,
      baseRevision,
      getWorkspaceSnapshot(useWorkspaceStore.getState()),
    )
    useWorkspaceStore.getState().setCloudState("synced", {
      error: null,
      revision: result.revision,
    })
  } catch (error) {
    const current = useWorkspaceStore.getState()

    if (error instanceof WorkspaceApiError && error.status === 409) {
      current.setCloudState("conflict", {
        error: "This workspace changed elsewhere. Reload before overwriting the newer cloud copy.",
      })
    } else if (!navigator.onLine || error instanceof TypeError) {
      current.setCloudState("offline", {
        error: "Cloud sync is unavailable. Your changes remain stored in this browser.",
      })
    } else {
      current.setCloudState("error", {
        error: error instanceof Error ? error.message : "Cloud sync failed.",
      })
    }
  } finally {
    syncInFlight = false
    if (syncAgain) {
      syncAgain = false
      scheduleSync()
    }
  }
}

export const retryCloudSync = () => {
  if (!ready) return
  void syncWorkspace()
}

export const startCloudSync = () => {
  if (started || typeof window === "undefined") return
  started = true

  useWorkspaceStore.subscribe((state, previous) => {
    const workspaceChanged =
      state.nodes !== previous.nodes ||
      state.activeDocumentId !== previous.activeDocumentId ||
      state.expandedItems !== previous.expandedItems ||
      state.lastSavedAt !== previous.lastSavedAt

    if (workspaceChanged) scheduleSync()
  })

  window.addEventListener("online", retryCloudSync)
  window.addEventListener("offline", () => {
    useWorkspaceStore.getState().setCloudState("offline", {
      error: "Changes are saved locally and will sync when you are back online.",
    })
  })

  void bootstrap().catch((error) => {
    ready = true
    useWorkspaceStore.getState().setCloudState("error", {
      error: error instanceof Error ? error.message : "Unable to initialize cloud sync.",
    })
  })
}
