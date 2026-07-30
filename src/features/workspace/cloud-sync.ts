import { create } from "zustand"
import {
  bootstrapWorkspace,
  replaceWorkspaceSnapshot,
  WorkspaceApiError,
  type WorkspaceSnapshot,
} from "@/lib/workspace-api"
import { useWorkspaceStore } from "@/features/workspace/workspace-store"

export type CloudSyncStatus =
  | "idle"
  | "connecting"
  | "saving"
  | "synced"
  | "offline"
  | "error"

interface CloudSyncState {
  status: CloudSyncStatus
  revision: number
  lastSyncedAt: string | null
  error: string | null
  retry: () => Promise<void>
}

let initialized = false
let initializationPromise: Promise<void> | null = null
let unsubscribeWorkspace: (() => void) | null = null
let saveTimer: number | null = null
let retryTimer: number | null = null
let mutationGeneration = 0
let saveInFlight: Promise<void> | null = null
let saveQueued = false
let onlineListenerRegistered = false

function snapshot(): WorkspaceSnapshot {
  const state = useWorkspaceStore.getState()
  return {
    nodes: state.nodes,
    selectedDocumentId: state.selectedDocumentId,
  }
}

function errorMessage(error: unknown) {
  if (error instanceof WorkspaceApiError || error instanceof Error) {
    return error.message
  }
  return "无法连接 Cloudflare 云端。"
}

function scheduleRetry() {
  if (typeof window === "undefined" || retryTimer !== null) return
  retryTimer = window.setTimeout(() => {
    retryTimer = null
    if (initialized) void flushWorkspaceSnapshot()
    else void initializeCloudSync()
  }, 5000)
}

async function flushWorkspaceSnapshot(): Promise<void> {
  if (!initialized) return
  if (saveInFlight) {
    saveQueued = true
    return saveInFlight
  }

  saveInFlight = (async () => {
    useCloudSyncStore.setState({ status: "saving", error: null })
    try {
      const result = await replaceWorkspaceSnapshot(snapshot())
      useCloudSyncStore.setState({
        status: "synced",
        revision: result.workspace.revision,
        lastSyncedAt: result.workspace.updatedAt,
        error: null,
      })
    } catch (error) {
      useCloudSyncStore.setState({
        status: error instanceof WorkspaceApiError ? "error" : "offline",
        error: errorMessage(error),
      })
      scheduleRetry()
    } finally {
      saveInFlight = null
      if (saveQueued) {
        saveQueued = false
        void flushWorkspaceSnapshot()
      }
    }
  })()

  return saveInFlight
}

function scheduleSnapshotSave(delay = 800) {
  if (typeof window === "undefined") return
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    void flushWorkspaceSnapshot()
  }, delay)
}

function subscribeToWorkspace() {
  if (unsubscribeWorkspace) return
  unsubscribeWorkspace = useWorkspaceStore.subscribe((state, previousState) => {
    if (
      state.nodes === previousState.nodes &&
      state.selectedDocumentId === previousState.selectedDocumentId
    ) {
      return
    }
    mutationGeneration += 1
    scheduleSnapshotSave()
  })
}

export const useCloudSyncStore = create<CloudSyncState>(() => ({
  status: "idle",
  revision: 0,
  lastSyncedAt: null,
  error: null,
  retry: flushWorkspaceSnapshot,
}))

export async function initializeCloudSync(): Promise<void> {
  if (initializationPromise) return initializationPromise
  if (initialized) return

  subscribeToWorkspace()
  initializationPromise = (async () => {
    const generationAtStart = mutationGeneration
    useCloudSyncStore.setState({ status: "connecting", error: null })

    try {
      const result = await bootstrapWorkspace(snapshot())
      const changedDuringBootstrap = mutationGeneration !== generationAtStart

      initialized = true
      if (!result.created && !changedDuringBootstrap) {
        useWorkspaceStore.setState({
          nodes: result.workspace.nodes,
          selectedDocumentId: result.workspace.selectedDocumentId,
        })
      } else if (changedDuringBootstrap) {
        await flushWorkspaceSnapshot()
        return
      }

      useCloudSyncStore.setState({
        status: "synced",
        revision: result.workspace.revision,
        lastSyncedAt: result.workspace.updatedAt,
        error: null,
      })
    } catch (error) {
      useCloudSyncStore.setState({
        status: error instanceof WorkspaceApiError ? "error" : "offline",
        error: errorMessage(error),
      })
      scheduleRetry()
    } finally {
      initializationPromise = null
    }
  })()

  if (typeof window !== "undefined" && !onlineListenerRegistered) {
    onlineListenerRegistered = true
    window.addEventListener("online", () => {
      if (initialized) void flushWorkspaceSnapshot()
      else void initializeCloudSync()
    })
  }

  return initializationPromise
}
