import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FAKE_TOKEN } from '@/api/fakeServer';
import { createHarness, renderScreen } from '@/test/utils';
import { LoginScreen } from './LoginScreen';
import { validateLogin } from './validation';

describe('validateLogin', () => {
  it('requires a valid email and 8+ char password', () => {
    expect(validateLogin('a@b.co', 'longenough')).toEqual({});
    expect(Object.keys(validateLogin('nope', 'short')).sort()).toEqual(['email', 'password']);
  });
});

describe('LoginScreen', () => {
  it('shows validation errors without calling the service', async () => {
    const h = createHarness({}, {}, false);
    const spy = jest.spyOn(h.services.auth, 'login');
    renderScreen(<LoginScreen />, h);
    fireEvent.press(screen.getByLabelText('Sign in'));
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows an error for wrong credentials and stores no token', async () => {
    const h = createHarness({}, {}, false);
    renderScreen(<LoginScreen />, h);
    fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');
    fireEvent.press(screen.getByLabelText('Sign in'));
    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(await h.services.tokenStore.get()).toBeNull();
  });

  it('stores the token in the token store on success', async () => {
    const h = createHarness({}, {}, false);
    renderScreen(<LoginScreen />, h);
    fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'adflow-demo');
    fireEvent.press(screen.getByLabelText('Sign in'));
    await waitFor(async () => expect(await h.services.tokenStore.get()).toBe(FAKE_TOKEN));
  });
});
