<script lang="ts">
  import { onMount } from "svelte"

  interface Entry {
    id: number
    text: string
    created_at: Date
  }

  let hostname = $state<string>()
  let wsConnection = $state(null as WebSocket | null)

  let inputElement: HTMLTextAreaElement | undefined = $state()

  let initialFetchDone = $state(false)

  let reconnectionTimer: ReturnType<typeof setTimeout> | null = $state(null)
  let reconnectionAttempts = $state(0)

  const dotStyle = $derived.by(() => {
    console.log("Checking WebSocket connection state...")
    if (!reconnectionTimer) {
      return "bg-white"
    } else {
      return "bg-white animate-pulse"
    }
  })

  let messages = $state<Entry[]>([])

  let posting = $state(false)

  const prepareConnection = (wsHostname: string) => {
    if (wsConnection?.readyState === WebSocket.OPEN) {
      console.log("WebSocket is already open")
      reconnectionTimer ? clearTimeout(reconnectionTimer) : null
      reconnectionTimer = null
      return
    }

    wsConnection = new WebSocket(wsHostname)
    console.log("Preparing WebSocket connection...")
    console.log(wsConnection)

    wsConnection.onopen = () => {
      console.log("WebSocket connection established")
      if (reconnectionTimer) {
        clearTimeout(reconnectionTimer)
        reconnectionTimer = null
      }
      reconnectionAttempts = 0 // Reset reconnection attempts
    }

    wsConnection.onerror = (error) => {
      console.error("WebSocket error:", error)
      retryConnection(wsHostname)
    }

    wsConnection.onclose = () => {
      console.log("WebSocket connection closed")
      retryConnection(wsHostname)
    }

    wsConnection.onmessage = (event) => {
      console.log("Received message:", event.data)
      addEntryFromServer(event.data)
    }
  }

  const addEntryFromServer = (entry: any) => {
    const newEntry = JSON.parse(entry)
    if (messages.map((m) => m.id).includes(newEntry.id)) {
      console.log("Entry already exists, skipping update")
      return
    }
    newEntry.created_at = new Date(newEntry.created_at) // Ensure timestamp is a Date object
    console.log("Adding new entry from server:", newEntry)
    messages = [newEntry, ...messages]
  }

  const handleMessagePosting = async () => {
    if (inputElement!.value.trim() !== "") {
      posting = true
      inputElement!.blur()
      try {
        const response = await fetch(`http://${hostname}:3123/api/addEntry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: inputElement!.value.trim() })
        })
        if (!response.ok) {
          posting = false
          throw new Error(`HTTP error! status: ${response.status}`)
        }
      } catch (error) {
        console.error("Error posting entry:", error)
        posting = false
        return
      }
      inputElement!.value = ""
      posting = false
      inputElement!.focus()
    }
  }

  const retryConnection = (wsHostname: string) => {
    if (reconnectionTimer) {
      clearTimeout(reconnectionTimer)
    }
    reconnectionAttempts += 1
    const delay = Math.min(1000 * reconnectionAttempts, 3000) // Exponential backoff with a max of 3 seconds
    console.log(`Reconnecting in ${delay}ms...`)
    reconnectionTimer = setTimeout(() => {
      prepareConnection(wsHostname)
    }, delay)
  }

  onMount(async () => {
    hostname = window.location.hostname
    const wsHostname = `ws://${hostname}:3123/api/ws`

    inputElement = document.getElementById("entry-input") as HTMLTextAreaElement

    console.log("Mounting component, preparing WebSocket connection...")
    prepareConnection(wsHostname)

    const fetchInitialEntries = async () => {
      await fetch(`http://${hostname}:3123/api/entries`)
        .then((response) => response.json())
        .then((data: Entry[]) => {
          messages = data.map((entry: Entry) => ({
            ...entry,
            created_at: new Date(entry.created_at) // Convert timestamp to milliseconds
          }))
          console.log("Fetched entries:", messages)
          initialFetchDone = true
        })
        .catch((error) => {
          console.error("Error fetching entries:", error)
          setTimeout(() => {
            fetchInitialEntries()
          }, 1000) // Set initialFetchDone to true after 1 second if fetch fails
        })
    }

    fetchInitialEntries()
  })
</script>

<div class="app-container">
  <div class="sticky top-0 z-10 bg-white">
    <div class="header bg-grey relative flex items-center justify-center p-2 text-white">
      <h1 class="text-xl">RECEIPT</h1>
      <div class="absolute top-0 right-4 flex h-full w-fit items-center justify-center">
        <span class="h-2 w-2 rounded {dotStyle}"></span>
      </div>
    </div>
    <div class="entry-input h-auto min-h-max border-b border-gray-200">
      <textarea
        placeholder={posting ? "Printing..." : "Type your entry here..."}
        class="field-sizing-content min-h-20 w-full bg-white p-2 text-sm text-gray-700 focus:outline-none"
        id="entry-input"
        enterkeyhint="enter"
        onkeypress={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            matchMedia("(hover: hover) and (pointer: fine)").matches
          ) {
            e.preventDefault()
            handleMessagePosting()
          }
        }}
        disabled={posting}
      ></textarea>
      <button
        class="show-on-touch w-full bg-black p-3 text-white {posting
          ? 'animate-pulse cursor-not-allowed'
          : ''}"
        onclick={() => handleMessagePosting()}
      >
        PRINT
      </button>
    </div>
  </div>

  <div>
    {#if initialFetchDone}
      {#each messages as message (message.id)}
        <div class="entry border-b border-gray-200 p-2">
          <div class="mb-1">
            <span class="bg-grey px-1 text-xs text-white"
              >{new Date(message.created_at)
                .toLocaleString("en-GB", { weekday: "short" })
                .toUpperCase()}
              {new Date(message.created_at).toLocaleString("en-GB", {
                dateStyle: "short",
                timeStyle: "short"
              })}</span
            >
          </div>
          <div class="text-grey/80 text-sm">
            {#each message.text.split("\n") as line, i}
              <p class="block" style="white-space: pre-wrap">
                {#if line.length !== 0}{line}{:else}&nbsp;{/if}
              </p>
            {/each}
          </div>
        </div>
      {/each}
    {:else}
      <div class="mt-5 text-center text-sm text-gray-500">
        <p>Loading entries...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  @import "./app.css";
  .app-container {
    @apply mx-auto max-w-xl min-[578px]:border-x min-[578px]:border-gray-200;
  }
  @media (hover: none) and (pointer: coarse) {
    .show-on-touch {
      display: block;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .show-on-touch {
      display: none;
    }
  }
</style>
