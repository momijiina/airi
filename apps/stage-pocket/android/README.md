# stage-pocket — Android

[Capacitor](https://capacitorjs.com/) で構築されたAIRIモバイルアプリ（Android版）。

- Min SDK: 24 (Android 7.0)
- Target SDK: 36 (Android 16)

## 前提条件

- [Node.js](https://nodejs.org/) 18+
- [Android Studio](https://developer.android.com/studio)（JDKとAndroid SDK含む）
- Android SDK Platform 36（Android Studio → SDK Managerでインストール）
- Android SDK Build-Tools（Android Studio → SDK Managerでインストール）

以下の環境変数を設定:

```
ANDROID_HOME=C:/Users/<you>/AppData/Local/Android/Sdk
JAVA_HOME=C:/Program Files/Android/Android Studio/jbr
```

> GradleはJava 21が必要です。Android Studioに同梱されているJBRが使えます。`JAVA_HOME` が設定されていないと、Gradleが古いシステムJavaにフォールバックし、`invalid source release: 21` で失敗することがあります。

## 開発

### 初回セットアップ

リポジトリルートから依存関係をインストール:

```bash
pnpm install
```

### デバイス/エミュレータで実行

Android Studioでプロジェクトを開く:

```bash
pnpm dev:android -- target <CAPACITOR_DEVICE_ID>
# または
CAPACITOR_DEVICE_ID=<CAPACITOR_DEVICE_ID> pnpm dev:android
```


## アプリアイコンとスプラッシュ画面の更新

ソースアセットは `../resources/` にあります:

| ファイル | 用途 |
|------|------|
| `icon-only.png` | アプリアイコン、1024×1024、背景なし |
| `icon-foreground.png` | アダプティブアイコン前景レイヤー、1024×1024 |
| `splash.png` | スプラッシュ画面、2732×2732 |

アイコンの背景色は白（`#FFFFFF`）で、`app/src/main/res/values/ic_launcher_background.xml` で定義されています。

ソースアセット更新後に全Androidアイコン/スプラッシュサイズを再生成するには:

```bash
# apps/stage-pocket/ から実行
npx @capacitor/assets@3.0.5 generate --android \
  --iconBackgroundColor "#FFFFFF" \
  --iconBackgroundColorDark "#000000" \
  --splashBackgroundColor "#FFFFFF" \
  --splashBackgroundColorDark "#000000"
```

`app/src/main/res/mipmap-*/` と `app/src/main/res/drawable-*/` の全ファイルが上書きされます。

> 実行後、`mipmap-anydpi-v26/ic_launcher.xml` と `ic_launcher_round.xml` が `@color/ic_launcher_background`（`@mipmap/ic_launcher_background` ではなく）を参照していることを確認してください。ツールが誤った参照を書き込むことがあります。必要に応じて `git checkout` で復元してください。

## 注意事項

- `app/src/main/assets/public/` と `app/src/main/assets/capacitor.config.json` は `cap sync` で生成され、gitignoreされています。
- `local.properties`（SDKパス）はマシン固有でgitignoreされています。
- `org.gradle.java.home` は `gradle.properties` に追加**すべきではありません**。Android Studioが自動追加した場合は削除してください。
