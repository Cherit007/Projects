import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authService } from '@fixture-maker/api/auth/authService';
import { isAppwriteConfigured } from '@fixture-maker/config/appwrite/env';

type AuthScreenProps = {
  onAuthenticated: () => void;
};

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const configured = isAppwriteConfigured();

  const handleSubmit = async () => {
    if (!configured) {
      setError('Appwrite is not configured. Set EXPO_PUBLIC_* env vars.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await authService.login(email.trim(), password);
      } else {
        await authService.register(name.trim() || email.trim(), email.trim(), password);
      }
      onAuthenticated();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Fixture Maker</Text>
      <Text style={styles.subtitle}>Sign in to manage tournaments with your group.</Text>

      {!configured ? (
        <Text style={styles.warning}>
          Missing Appwrite configuration. Set EXPO_PUBLIC_* in apps/mobile/.env, then restart Expo with cache clear (npx expo start -c).
        </Text>
      ) : null}

      {mode === 'register' ? (
        <TextInput
          style={styles.input}
          placeholder="Display name"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.link}>
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 24,
  },
  warning: {
    color: '#b45309',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  link: {
    marginTop: 16,
    textAlign: 'center',
    color: '#0f766e',
  },
  error: {
    color: '#b91c1c',
    marginBottom: 8,
  },
});
