## ThreadX

- [x] Wait for worker to confirm its alive before attempting to fire messages to it
- [x] Rectify the leaking of getter `lastMutator` into the BufferStruct (after writing tests)
  - SharedObject logic removed from BufferStruct
