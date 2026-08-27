package app.memora.reader

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Memora в собственном окне.
 *
 * Зачем приложение, если есть сайт: в браузере читалке мешают расширения. Плагин
 * переводчика перехватывает выделение текста, и выбор фразы перестаёт работать —
 * страница о таком даже не узнаёт. Здесь свой WebView, расширений в нём нет
 * вовсе, и этот источник помех исчезает целиком.
 *
 * Остальное — обвязка под экран из электронных чернил: быстрый режим обновления,
 * никаких анимаций, аппаратные кнопки листания и постоянно включённое экономное
 * оформление.
 */
class MainActivity : AppCompatActivity() {

    private companion object {
        const val APP_URL = "https://memora-web-production.up.railway.app/"
        const val APP_HOST = "memora-web-production.up.railway.app"

        /**
         * Хосты входа через Google. Отправлять их в браузер бессмысленно: там
         * человек войдёт, а сессия достанется браузеру, и приложение останется
         * ни с чем. Открыть их здесь тоже нельзя — Google намеренно запрещает
         * вход в аккаунт из встроенных браузеров. Поэтому объясняем прямо.
         */
        val AUTH_HOSTS = setOf(
            "accounts.google.com",
            "accounts.youtube.com",
            "oauth2.googleapis.com",
        )

        /**
         * Включаем экономное оформление до того, как страница отрисуется.
         * Оно же само подхватится при следующих загрузках — значение сохраняется.
         */
        const val EINK_JS = """
            (function () {
              try {
                localStorage.setItem('memora.eink', 'on');
                document.documentElement.setAttribute('data-eink', 'on');
              } catch (e) {}
            })();
        """
    }

    private lateinit var web: WebView

    /** Ожидающий запрос микрофона от страницы — держим, пока система спрашивает. */
    private var pendingMic: PermissionRequest? = null

    /** Ожидающий выбор файла: без него не загрузить книгу. */
    private var pendingFiles: ValueCallback<Array<Uri>>? = null

    private val micPermission: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pendingMic
            pendingMic = null
            if (request == null) return@registerForActivityResult
            if (granted) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                request.deny()
            }
        }

    private val fileChooser: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = pendingFiles
            pendingFiles = null
            callback?.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            )
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        web = WebView(this)
        setContentView(web)

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Озвучка запускается кодом страницы, а не нажатием по плееру:
            // без этого разрешения браузерный движок её молча глушит.
            mediaPlaybackRequiresUserGesture = false
            setSupportMultipleWindows(false)
            // Своя вёрстка уже подстроена под ширину: пусть движок не масштабирует.
            useWideViewPort = false
            loadWithOverviewMode = false
        }

        // Мелочи, из которых складывается спокойный экран: полосы прокрутки не
        // затухают (затухание — это лишняя перерисовка), край не пружинит.
        web.isScrollbarFadingEnabled = false
        web.isVerticalScrollBarEnabled = false
        web.overScrollMode = View.OVER_SCROLL_NEVER

        web.webViewClient = MemoraWebViewClient()
        web.webChromeClient = MemoraChromeClient()

        EinkDevice.applyFastMode(web)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })

        if (savedInstanceState == null) web.loadUrl(APP_URL) else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    /**
     * Кнопки громкости листают страницу.
     *
     * У самой Nova Air боковых кнопок нет, но выносная «листалка» по Bluetooth
     * шлёт именно эти коды. Страница уже понимает стрелки — отправляем их ей,
     * ничего не изобретая.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val key = when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> "ArrowRight"
            KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_PAGE_UP -> "ArrowLeft"
            else -> return super.onKeyDown(keyCode, event)
        }
        web.evaluateJavascript(
            "window.dispatchEvent(new KeyboardEvent('keydown',{key:'$key',bubbles:true}));",
            null,
        )
        return true
    }

    private inner class MemoraWebViewClient : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val uri = request?.url ?: return false
            // Свои страницы открываем внутри, чужие ссылки отдаём системе:
            // иначе приложение превратится в браузер со всеми его бедами.
            if (uri.host == APP_HOST) return false

            if (uri.host in AUTH_HOSTS) {
                view?.loadDataWithBaseURL(null, googleAuthHtml(), "text/html", "utf-8", null)
                return true
            }

            return runCatching {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                true
            }.getOrElse { false }
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            view?.evaluateJavascript(EINK_JS, null)
        }

        override fun onReceivedError(
            view: WebView?,
            request: WebResourceRequest?,
            error: WebResourceError?,
        ) {
            // Реагируем только на провал самой страницы: неудачная картинка или
            // запрос в фоне не повод показывать экран ошибки.
            if (request?.isForMainFrame != true) return
            view?.loadDataWithBaseURL(null, offlineHtml(), "text/html", "utf-8", null)
        }
    }

    private inner class MemoraChromeClient : WebChromeClient() {

        override fun onPermissionRequest(request: PermissionRequest?) {
            val wanted = request?.resources ?: return
            if (!wanted.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                request.deny()
                return
            }
            val granted = ContextCompat.checkSelfPermission(
                this@MainActivity, Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED

            if (granted) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                pendingMic = request
                micPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }

        override fun onShowFileChooser(
            webView: WebView?,
            callback: ValueCallback<Array<Uri>>?,
            params: FileChooserParams?,
        ): Boolean {
            // Прежний выбор надо закрыть, иначе страница будет ждать его вечно.
            pendingFiles?.onReceiveValue(null)
            pendingFiles = callback

            val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            return try {
                fileChooser.launch(intent)
                true
            } catch (e: ActivityNotFoundException) {
                pendingFiles = null
                callback?.onReceiveValue(null)
                false
            }
        }
    }

    /**
     * Объяснение вместо тупика.
     *
     * Молча выбрасывать в браузер было хуже всего: человек честно входил там,
     * возвращался в приложение и видел, что он по-прежнему не вошёл, — без
     * малейшего намёка на причину.
     */
    private fun googleAuthHtml(): String = """
        <!doctype html><html lang="ru"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body{background:#fff;color:#000;font:18px/1.55 sans-serif;margin:0;
               display:flex;min-height:100vh;align-items:center;justify-content:center}
          div{padding:24px;max-width:30em}
          h1{font-size:22px;margin:0 0 12px}
          p{margin:0 0 12px}
          ol{margin:0 0 12px 1.2em;padding:0}
          li{margin-bottom:6px}
          a{display:inline-block;margin-top:12px;padding:14px 28px;border:3px solid #000;
            color:#000;text-decoration:none;font-weight:700}
        </style></head><body><div>
        <h1>Вход через Google здесь не работает</h1>
        <p>Так решил сам Google: он не разрешает вход в аккаунт из приложений
        со встроенным браузером. Обойти это нельзя, но и не нужно.</p>
        <ol>
          <li>Откройте Memora на компьютере или телефоне</li>
          <li>Зайдите в «Мой кабинет» → «Пароль для приложения»</li>
          <li>Задайте пароль и вернитесь сюда</li>
        </ol>
        <p>Здесь входите той же почтой и этим паролем. На сайте вход через
        Google продолжит работать как прежде.</p>
        <a href="$APP_URL">К входу по паролю</a>
        </div></body></html>
    """.trimIndent()

    /** Страница «нет связи» — своя, чтобы не показывать системную с мелким шрифтом. */
    private fun offlineHtml(): String = """
        <!doctype html><html lang="ru"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body{background:#fff;color:#000;font:20px/1.5 sans-serif;margin:0;
               display:flex;min-height:100vh;align-items:center;justify-content:center}
          div{text-align:center;padding:24px;max-width:26em}
          a{display:inline-block;margin-top:20px;padding:14px 28px;border:3px solid #000;
            color:#000;text-decoration:none;font-weight:700}
        </style></head><body><div>
        <p>Нет соединения с Memora.</p>
        <p style="font-size:16px">Проверьте сеть — книги и упражнения загружаются с сервера.</p>
        <a href="$APP_URL">Попробовать снова</a>
        </div></body></html>
    """.trimIndent()
}
