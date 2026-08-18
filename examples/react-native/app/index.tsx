import { useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  HopeMetahumanView,
  type HopeMetahumanEvent,
  type HopeMetahumanViewHandle,
} from '@/components/HopeMetahumanView';

const configuration = {
  baseUrl: process.env.EXPO_PUBLIC_HOPE_API_BASE ?? 'https://api.example.invalid',
  tokenEndpoint:
    process.env.EXPO_PUBLIC_HOPE_TOKEN_ENDPOINT ?? 'https://app.example.invalid/api/hope/token',
  voiceId: process.env.EXPO_PUBLIC_HOPE_VOICE_ID ?? 'replace-with-a-voice-id',
  standardMetahumanId: process.env.EXPO_PUBLIC_HOPE_STANDARD_METAHUMAN_ID,
  standardModelUrl:
    process.env.EXPO_PUBLIC_HOPE_STANDARD_MODEL_URL ?? 'https://assets.example.invalid/avatar.glb',
  premiumMetahumanId:
    process.env.EXPO_PUBLIC_HOPE_PREMIUM_METAHUMAN_ID ?? '00000000-0000-0000-0000-000000000000',
  premiumPosterUrl: process.env.EXPO_PUBLIC_HOPE_PREMIUM_POSTER_URL,
};

export default function HomeScreen() {
  const metahuman = useRef<HopeMetahumanViewHandle>(null);
  const [kind, setKind] = useState<'standard' | 'premium'>('standard');
  const [status, setStatus] = useState('Press Start conversation inside the view');

  const onEvent = (event: HopeMetahumanEvent) => {
    if (event.type === 'state') setStatus(event.state);
    else if (event.type === 'avatar-state') setStatus(`Premium avatar: ${event.state}`);
    else if (event.type === 'error') setStatus(event.message);
  };

  const shared = {
    baseUrl: configuration.baseUrl,
    tokenEndpoint: configuration.tokenEndpoint,
    voiceId: configuration.voiceId,
    metahumanName: 'HOPE',
    onEvent,
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>HOPE Metahuman</Text>
        <View style={styles.switcher}>
          {(['standard', 'premium'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === value }}
              onPress={() => setKind(value)}
              style={[styles.switchButton, kind === value && styles.switchButtonActive]}
            >
              <Text style={styles.switchLabel}>{value}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {kind === 'standard' ? (
        <HopeMetahumanView
          ref={metahuman}
          {...shared}
          kind="standard"
          modelUrl={configuration.standardModelUrl}
          metahumanId={configuration.standardMetahumanId}
          framing="bust"
          style={styles.metahuman}
        />
      ) : (
        <HopeMetahumanView
          ref={metahuman}
          {...shared}
          kind="premium"
          metahumanId={configuration.premiumMetahumanId}
          posterUrl={configuration.premiumPosterUrl}
          style={styles.metahuman}
        />
      )}

      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {status}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09101f' },
  header: { paddingHorizontal: 18, paddingVertical: 12, gap: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  switcher: { flexDirection: 'row', gap: 8 },
  switchButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#17233a',
  },
  switchButtonActive: { backgroundColor: '#4263eb' },
  switchLabel: { color: '#fff', textTransform: 'capitalize', fontWeight: '600' },
  metahuman: { flex: 1, marginHorizontal: 12, borderRadius: 18, backgroundColor: '#101a2c' },
  status: { color: '#aebbd1', padding: 16, textAlign: 'center' },
});
