package app.memora.reader

import android.util.Log
import android.view.View

/**
 * Управление режимом обновления экрана на устройствах Onyx Boox.
 *
 * Работаем через отражение, а не через зависимость от SDK Onyx: он
 * распространяется отдельно, есть не на всех прошивках, и приложение не должно
 * из-за него падать на обычном телефоне. Если классов нет — молча ничего не
 * делаем, приложение остаётся рабочим.
 *
 * Смысл настройки: по умолчанию система обновляет экран качественно и медленно,
 * с полной перерисовкой. Для листания текста это избыточно — быстрый режим
 * рисует заметно резвее ценой оттенков серого, и именно он убирает ощущение
 * вязкости при перелистывании.
 */
object EinkDevice {

    private const val TAG = "EinkDevice"

    /** Известные точки входа в разных поколениях прошивок Onyx. */
    private val CONTROLLERS = listOf(
        "com.onyx.android.sdk.api.device.epd.EpdController",
        "android.onyx.EPDManager",
    )

    /** Есть ли на устройстве управление обновлением экрана. */
    val available: Boolean by lazy {
        CONTROLLERS.any { name -> runCatching { Class.forName(name) }.isSuccess }
    }

    /**
     * Просит систему обновлять эту область быстрым режимом.
     * Вызов безопасен на любом устройстве: неудача просто ничего не меняет.
     */
    fun applyFastMode(view: View) {
        if (!available) {
            Log.i(TAG, "управление обновлением экрана недоступно — работаем как есть")
            return
        }
        for (name in CONTROLLERS) {
            val done = runCatching {
                val controller = Class.forName(name)
                val modeClass = Class.forName("com.onyx.android.sdk.api.device.epd.UpdateMode")
                val mode = modeClass.getField("DU").get(null)
                controller
                    .getMethod("setViewDefaultUpdateMode", View::class.java, modeClass)
                    .invoke(null, view, mode)
                true
            }.getOrElse { false }
            if (done) {
                Log.i(TAG, "быстрый режим обновления включён через $name")
                return
            }
        }
    }
}
