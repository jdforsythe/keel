import { AccountsText } from "../AccountsText.schema.ts";

export default AccountsText.text({
  signinTitle: "サインイン · Keel",
  signinHeading: "サインイン",
  signupTitle: "アカウント作成 · Keel",
  signupHeading: "アカウント作成",
  nameLabel: "名前",
  emailLabel: "メールアドレス",
  passwordLabel: "パスワード",
  signinSubmit: "サインイン",
  signupSubmit: "アカウントを作成",
  signedInAs: { text: "{email} でサインイン中" },
  signOut: "サインアウト",
  toSignup: "アカウントを作成",
  toSignin: "サインインする",
  errorCredentials: "メールアドレスまたはパスワードが違います",
  errorInvalid: "入力内容を確認してもう一度お試しください",
});
