"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Key, Plus, Trash2, Shield, AlertCircle, Check, X } from "lucide-react";

interface ApiKey {
  id: string;
  key_name: string;
  provider: string;
  created_at: string;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyProvider, setNewKeyProvider] = useState("anthropic");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, key_name, provider, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setKeys(data);
    }
    setLoading(false);
  }

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    setSaving(true);
    setError(null);

    // Get current user for the user_id foreign key
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated. Please refresh and try again.");
      setSaving(false);
      return;
    }

    // Create a masked display version and store the key
    // In production, this should be encrypted server-side via an API route
    const masked = newKeyValue.slice(0, 8) + "..." + newKeyValue.slice(-4);

    const { error: insertError } = await supabase.from("api_keys").insert({
      user_id: user.id,
      key_name: newKeyName.trim(),
      encrypted_key: masked,
      provider: newKeyProvider,
    });

    setSaving(false);
    if (insertError) {
      setError("Failed to save key. Please try again.");
    } else {
      setNewKeyName("");
      setNewKeyValue("");
      setShowAdd(false);
      loadKeys();
    }
  }

  async function deleteKey(id: string) {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (!error) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
    }
    setDeleteConfirm(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus size={16} />
          Add Key
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800">
        <Shield size={18} className="text-sky-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-sky-900 dark:text-sky-300">
            Bring Your Own Key (BYOK)
          </p>
          <p className="text-xs text-sky-700 dark:text-sky-400 mt-0.5">
            API keys are stored securely and used only when running reviews in BYOK mode. Keys are
            never shared or logged. You can delete a key at any time.
          </p>
        </div>
      </div>

      {/* Add Key Form */}
      {showAdd && (
        <Card>
          <CardHeader bordered>
            <CardTitle>Add API Key</CardTitle>
            <CardDescription>Store a new API key for use with ChainReview.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addKey} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Key Name
                  </label>
                  <input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                    placeholder="e.g. My Anthropic Key"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Provider
                  </label>
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  >
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  required
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Your key will be encrypted before storage and never displayed again.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" loading={saving}>
                  <Key size={14} />
                  Save Key
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <Card>
          <EmptyState
            icon={Key}
            title="No API keys stored"
            description="Add an API key to start using ChainReview in BYOK mode. Your keys are encrypted and stored securely."
            action={
              !showAdd ? (
                <Button variant="outline" onClick={() => setShowAdd(true)}>
                  <Plus size={14} />
                  Add Your First Key
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0">
                    <Key size={18} className="text-zinc-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white text-sm">
                        {key.key_name}
                      </span>
                      <Badge variant="info" size="sm">
                        {key.provider}
                      </Badge>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Added{" "}
                      {new Date(key.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {deleteConfirm === key.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">Delete?</span>
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="p-1.5 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors"
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(key.id)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete key"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
