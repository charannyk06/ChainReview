I have the following finding after thorough review of the codebase.
Implement the fix by following the instructions verbatim.

---

## Finding: Circular dependency between Tasks and Messages modules

**Severity:** HIGH | **Confidence:** 95%
**Category:** architecture | **Agent:** architecture

Both bytebot-agent and bytebot-agent-cc packages have circular dependencies between TasksModule and MessagesModule. The MessagesModule imports TasksModule using forwardRef(), and TasksModule directly imports MessagesModule. This creates tight coupling and can lead to initialization issues, runtime errors, and makes the code harder to maintain. This pattern is repeated identically in both packages, indicating systematic architectural issues.

### Evidence

**packages/bytebot-agent/src/messages/messages.module.ts** (lines 6-7):
```
imports: [PrismaModule, forwardRef(() => TasksModule)],
```

**packages/bytebot-agent/src/tasks/tasks.module.ts** (lines 8-9):
```
imports: [PrismaModule, MessagesModule],
```

### Relevant Files
- packages/bytebot-agent/src/messages/messages.module.ts
- packages/bytebot-agent/src/tasks/tasks.module.ts

---

Please fix this issue. The fix should address the root cause described above while maintaining existing functionality.
After completing the fix, verify that the code compiles and passes any existing tests.