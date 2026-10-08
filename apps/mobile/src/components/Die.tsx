import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { t } from '../i18n';

const native = Platform.OS !== 'web';

/** Where the pips sit on a 3x3 grid (row, column), for each face. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 2],
    [2, 0],
  ],
  3: [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

interface Props {
  /** 1..6, or 0 for a die not rolled yet (drawn blank). */
  value: number;
  size?: number;
  /** Kept aside: gold outline, lifted, with a small lock. */
  held?: boolean;
  /** Changes at every roll: the die tumbles (unless it is held). */
  rollKey?: number;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** A white die with its pips drawn as dots. */
export function Die({ value, size = 48, held, rollKey, onPress, disabled, accessibilityLabel }: Props) {
  const spin = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(held ? 1 : 0)).current;
  const [face, setFace] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current || held || !value) {
      first.current = false;
      setFace(value);
      return;
    }
    // Tumble: spin and bounce while the face flickers, then land on the real value.
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
    let n = 0;
    const id = setInterval(() => {
      n++;
      if (n >= 6) {
        clearInterval(id);
        setFace(value);
      } else setFace(1 + Math.floor(Math.random() * 6));
    }, 70);
    return () => clearInterval(id);
    // Only a new roll animates; holding or releasing does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  useEffect(() => {
    if (!value) setFace(0);
  }, [value]);

  useEffect(() => {
    Animated.spring(lift, { toValue: held ? 1 : 0, useNativeDriver: native, friction: 6 }).start();
  }, [held, lift]);

  const pip = Math.max(5, Math.round(size * 0.17));
  const pad = size * 0.14;
  const cell = (size - 2 * pad) / 3;
  const radius = size * 0.2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (value ? (held ? t('Dé {n}, gardé', { n: value }) : t('Dé {n}', { n: value })) : t('Dé'))
      }
      accessibilityState={{ selected: !!held, disabled: disabled || !onPress }}
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={4}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.14] }) },
            {
              rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '0deg'] }),
            },
            { scale: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.12, 1] }) },
          ],
        }}
      >
        <View
          style={[
            styles.die,
            { width: size, height: size, borderRadius: radius },
            held && [styles.held, { borderRadius: radius }],
          ]}
        >
          <View style={[styles.shine, { borderRadius: radius }]} />
          {face === 0 ? (
            <Text style={[styles.blank, { fontSize: size * 0.42 }]}>?</Text>
          ) : (
            PIPS[face].map(([r, c], i) => (
              <View
                key={i}
                style={[
                  styles.pip,
                  face === 1 && styles.pipRed,
                  {
                    width: face === 1 ? pip * 1.35 : pip,
                    height: face === 1 ? pip * 1.35 : pip,
                    borderRadius: pip,
                    left: pad + c * cell + cell / 2 - (face === 1 ? pip * 0.675 : pip / 2),
                    top: pad + r * cell + cell / 2 - (face === 1 ? pip * 0.675 : pip / 2),
                  },
                ]}
              />
            ))
          )}
        </View>
        {held && (
          <View style={[styles.lock, { top: -size * 0.16, right: -size * 0.16 }]}>
            <Text style={styles.lockText}>🔒</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  die: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#d9d0b8',
    boxShadow: '0 4px 8px rgba(0,0,0,0.45), inset 0 -3px 0 rgba(0,0,0,0.12)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  held: {
    borderWidth: 3,
    borderColor: colors.gold,
    boxShadow: `0 0 12px ${colors.gold}, 0 4px 8px rgba(0,0,0,0.45)`,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  pip: {
    position: 'absolute',
    backgroundColor: colors.black,
    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25)',
  },
  pipRed: { backgroundColor: colors.red },
  blank: { color: 'rgba(0,0,0,0.18)', fontWeight: '800' },
  lock: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  lockText: { fontSize: 11 },
});
