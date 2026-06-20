/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import {
  Button,
  Card,
  Flex,
  Form,
  Image,
  Input,
  Typography,
  Icons,
} from '@superset-ui/core/components';
import { useState, useEffect, useMemo } from 'react';
import { capitalize } from 'lodash/fp';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { useDispatch } from 'react-redux';
import getBootstrapData from 'src/utils/getBootstrapData';

type OAuthProvider = {
  name: string;
  icon: string;
};

type OIDProvider = {
  name: string;
  url: string;
};

type Provider = OAuthProvider | OIDProvider;

interface LoginForm {
  username: string;
  password: string;
}

enum AuthType {
  AuthOID = 0,
  AuthDB = 1,
  AuthLDAP = 2,
  AuthOauth = 4,
  AuthSAML = 5,
}

const StyledLoginWrapper = styled(Flex)`
  ${({ theme }) => css`
    width: 100%;
    min-height: 100vh;
    background: linear-gradient(
      135deg,
      ${theme.colorPrimary} 0%,
      ${theme.colorPrimaryBg} 50%,
      ${theme.colorPrimary} 100%
    );
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        ${theme.colorInfoBgHover} 0%,
        transparent 70%
      );
    }

    &::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        ${theme.colorInfoBg} 0%,
        transparent 70%
      );
    }
  `}
`;

const StyledCard = styled(Card)`
  ${({ theme }) => css`
    max-width: 420px;
    width: 100%;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    backdrop-filter: blur(20px);
    box-shadow: 0 25px 50px -12px ${theme.colorFillQuaternary};
    z-index: 1;
    .ant-form-item-label label {
      color: ${theme.colorPrimary};
    }
  `}
`;

const StyledLogoContainer = styled(Flex)`
  z-index: 1;
  margin-bottom: 32px;
`;

const StyledTagline = styled(Typography.Text)`
  ${({ theme }) => css`
    color: ${theme.colorTextLightSolid};
    font-size: 14px;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: 12px;
    opacity: 0.7;
  `}
`;

const StyledLabel = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export default function Login() {
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const bootstrapData = getBootstrapData();
  const nextUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('next') || '';
    } catch (_error) {
      return '';
    }
  }, []);

  const loginEndpoint = useMemo(
    () => (nextUrl ? `/login/?next=${encodeURIComponent(nextUrl)}` : '/login/'),
    [nextUrl],
  );

  const buildProviderLoginUrl = (providerName: string) => {
    const base = `/login/${providerName}`;
    return nextUrl
      ? `${base}${base.includes('?') ? '&' : '?'}next=${encodeURIComponent(nextUrl)}`
      : base;
  };

  const authType: AuthType = bootstrapData.common.conf.AUTH_TYPE;
  const providers: Provider[] = bootstrapData.common.conf.AUTH_PROVIDERS;
  const authRegistration: boolean =
    bootstrapData.common.conf.AUTH_USER_REGISTRATION;

  // TODO: This is a temporary solution for showing login errors after form submission.
  // Should be replaced with proper SPA-style authentication (JSON API with error responses)
  // when Flask-AppBuilder is updated or we implement a custom login endpoint.
  useEffect(() => {
    const loginAttempted = sessionStorage.getItem('login_attempted');

    if (loginAttempted === 'true') {
      sessionStorage.removeItem('login_attempted');
      dispatch(addDangerToast(t('Invalid username or password')));
      // Clear password field for security
      form.setFieldsValue({ password: '' });
    }
  }, [dispatch, form]);

  const onFinish = (values: LoginForm) => {
    setLoading(true);

    // Mark that we're attempting login (for error detection after redirect)
    sessionStorage.setItem('login_attempted', 'true');

    // Use standard form submission for Flask-AppBuilder compatibility
    SupersetClient.postForm(loginEndpoint, values, '');
  };

  const getAuthIconElement = (
    providerName: string,
  ): React.JSX.Element | undefined => {
    if (!providerName || typeof providerName !== 'string') {
      return undefined;
    }
    const iconComponentName = `${capitalize(providerName)}Outlined`;
    const IconComponent = (Icons as Record<string, React.ComponentType<any>>)[
      iconComponentName
    ];

    if (IconComponent && typeof IconComponent === 'function') {
      return <IconComponent />;
    }
    return undefined;
  };

  return (
    <StyledLoginWrapper
      justify="center"
      align="center"
      vertical
      data-test="login-form"
    >
      <StyledLogoContainer align="center" vertical>
        <Image
          preview={false}
          src="/static/assets/branding/acme-logo-horiz.svg"
          alt={t('ACME Analytics')}
          height={48}
          css={css`
            filter: brightness(0) invert(1);
          `}
        />
        <StyledTagline>{t('Data-Driven Decisions')}</StyledTagline>
      </StyledLogoContainer>
      <StyledCard title={t('Sign in')} padded>
        {authType === AuthType.AuthOID && (
          <Flex justify="center" vertical gap="middle">
            <Form layout="vertical" requiredMark="optional" form={form}>
              {providers.map((provider: OIDProvider) => (
                <Form.Item<LoginForm>>
                  <Button
                    href={buildProviderLoginUrl(provider.name)}
                    block
                    iconPosition="start"
                    icon={getAuthIconElement(provider.name)}
                  >
                    {t('Sign in with')} {capitalize(provider.name)}
                  </Button>
                </Form.Item>
              ))}
            </Form>
          </Flex>
        )}
        {(authType === AuthType.AuthOauth ||
          authType === AuthType.AuthSAML) && (
          <Flex justify="center" gap={0} vertical>
            <Form layout="vertical" requiredMark="optional" form={form}>
              {providers.map((provider: OAuthProvider) => (
                <Form.Item<LoginForm>>
                  <Button
                    href={buildProviderLoginUrl(provider.name)}
                    block
                    iconPosition="start"
                    icon={getAuthIconElement(provider.name)}
                  >
                    {t('Sign in with')} {capitalize(provider.name)}
                  </Button>
                </Form.Item>
              ))}
            </Form>
          </Flex>
        )}

        {(authType === AuthType.AuthDB || authType === AuthType.AuthLDAP) && (
          <Flex justify="center" vertical gap="middle">
            <Typography.Text type="secondary">
              {t('Enter your login and password below:')}
            </Typography.Text>
            <Form
              layout="vertical"
              requiredMark="optional"
              form={form}
              onFinish={onFinish}
            >
              <Form.Item<LoginForm>
                label={<StyledLabel>{t('Username:')}</StyledLabel>}
                name="username"
                rules={[
                  { required: true, message: t('Please enter your username') },
                ]}
              >
                <Input
                  autoFocus
                  prefix={<Icons.UserOutlined iconSize="l" />}
                  data-test="username-input"
                />
              </Form.Item>
              <Form.Item<LoginForm>
                label={<StyledLabel>{t('Password:')}</StyledLabel>}
                name="password"
                rules={[
                  { required: true, message: t('Please enter your password') },
                ]}
              >
                <Input.Password
                  prefix={<Icons.KeyOutlined iconSize="l" />}
                  data-test="password-input"
                />
              </Form.Item>
              <Form.Item label={null}>
                <Flex
                  css={css`
                    width: 100%;
                  `}
                >
                  <Button
                    block
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    data-test="login-button"
                  >
                    {t('Sign in')}
                  </Button>
                  {authRegistration && (
                    <Button
                      block
                      type="default"
                      href="/register/"
                      data-test="register-button"
                    >
                      {t('Register')}
                    </Button>
                  )}
                </Flex>
              </Form.Item>
            </Form>
          </Flex>
        )}
      </StyledCard>
    </StyledLoginWrapper>
  );
}
